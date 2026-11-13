/**
 * CSV import logic (pure, no I/O) so it can be unit-tested.
 *
 * Semantics that matter on event day:
 * - A blank workshop cell means "leave unchanged" for an existing student, null for a new one.
 * - The literal "No Workshop" means "clear the assignment".
 * - Workshop names are matched after trimming, collapsing whitespace and ignoring case,
 *   so "F 2:  Short-Form" and "f 2: short-form" are the same workshop.
 * - Existing workshop room/capacity/description are never overwritten with blanks.
 * - Crew rows (every assigned slot is "Stage Crew" or "Video Crew") are staff, not attendees:
 *   never created, and an existing student is cleared of workshops and marked not_attending.
 *   A crew name in just one slot counts as "No Workshop" for that slot. Crew workshops are
 *   never created.
 * - Students missing from the CSV are reported, never deleted. The caller may mark them
 *   not_attending (soft, reversible); a student who reappears in a later CSV is un-marked.
 */

export type SlotValue = string | null | undefined; // name | explicit clear | unchanged

export interface ParsedRow {
  line: number;
  registration_id: string;
  student_name: string;
  supervisor_name: string | null;
  supervisor_email: string;
  workshop_slot1_name: SlotValue;
  workshop_slot2_name: SlotValue;
  room_location: string | null;
  notes: string | null;
  /** Crew row: keep out of workshops, counts and emails. */
  crew?: boolean;
}

export interface RowError {
  line: number;
  registration_id?: string;
  message: string;
}

export interface ExistingStudent {
  id: string;
  registration_id: string;
  student_name: string;
  supervisor_name: string | null;
  supervisor_email: string;
  workshop_slot1_id: string | null;
  workshop_slot2_id: string | null;
  notes: string | null;
  not_attending?: boolean;
}

export interface ExistingWorkshop {
  id: string;
  workshop_name: string;
  time_slot: number;
  room_location: string | null;
}

export interface WorkshopPlanItem {
  key: string; // normalized key `${slot}|${name}`
  name: string; // canonical name to store (existing name if matched)
  time_slot: 1 | 2;
  action: 'match' | 'create' | 'update_room';
  id: string | null; // existing id when matched
  room_before: string | null;
  room_after: string | null;
  student_count: number;
}

export interface FieldChange {
  field: string;
  before: string | null;
  after: string | null;
}

export interface StudentPlanItem {
  registration_id: string;
  student_name: string;
  action: 'create' | 'update' | 'unchanged';
  id: string | null;
  changes: FieldChange[];
  /** Resolved values to write. Slot ids may be a workshop key (`create:<key>`) in dry-run. */
  values: {
    student_name: string;
    supervisor_name: string | null;
    supervisor_email: string;
    notes: string | null;
    workshop_slot1: { set: boolean; workshopKey: string | null };
    workshop_slot2: { set: boolean; workshopKey: string | null };
  };
}

export interface ImportPlan {
  workshops: WorkshopPlanItem[];
  students: StudentPlanItem[];
  missingFromCsv: Array<{ id: string; registration_id: string; student_name: string; not_attending: boolean }>;
  warnings: string[];
  errors: RowError[];
  summary: {
    rows: number;
    studentsCreate: number;
    studentsUpdate: number;
    studentsUnchanged: number;
    workshopsCreate: number;
    workshopsMatch: number;
    roomUpdates: number;
    missingFromCsv: number;
  };
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** RFC 4180-ish parser: quoted fields, doubled quotes, newlines inside quotes, CRLF, BOM. */
export function parseCsv(text: string): { headers: string[]; records: Array<{ line: number; values: string[] }> } {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: Array<{ line: number; values: string[] }> = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    if (row.some((v) => v.trim() !== '')) rows.push({ line: rowStartLine, values: row });
    row = [];
    rowStartLine = line;
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\r') {
      // handled by the following \n, or treat lone \r as newline
      if (src[i + 1] !== '\n') {
        line++;
        pushRow();
      }
    } else if (ch === '\n') {
      line++;
      pushRow();
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) pushRow();

  if (rows.length === 0) return { headers: [], records: [] };
  const [headerRow, ...records] = rows;
  return { headers: headerRow.values.map((h) => h.trim()), records };
}

const COLUMN_MAPPING: Record<string, string> = {
  'registrant id': 'registration_id',
  'registration id': 'registration_id',
  registration_id: 'registration_id',
  'name (last name)': 'last_name',
  'name (first name)': 'first_name',
  'first name': 'first_name',
  'last name': 'last_name',
  student_name: 'student_name',
  'student name': 'student_name',
  'breakout session i': 'workshop_slot1_name',
  'breakout session ii': 'workshop_slot2_name',
  workshop_slot1_name: 'workshop_slot1_name',
  workshop_slot2_name: 'workshop_slot2_name',
  'contact last name': 'supervisor_last_name',
  'contact first name': 'supervisor_first_name',
  'contact email': 'supervisor_email',
  supervisor_email: 'supervisor_email',
  'supervisor email': 'supervisor_email',
  supervisor_name: 'supervisor_name',
  'supervisor name': 'supervisor_name',
  'school/organization name': 'school',
  notes: 'notes',
  time_slot: 'time_slot',
  room_location: 'room_location',
  'room location': 'room_location',
};

export function normalizeHeader(h: string): string {
  return h.replace(/\s+/g, ' ').trim().toLowerCase();
}

export const NO_WORKSHOP_RE = /^no workshop$/i;
/** Event staff listed in the registration export; they are not scanned or reported. */
export const CREW_RE = /^(stage|video) crew$/i;

function slotValue(raw: string | undefined): SlotValue {
  if (raw === undefined) return undefined;
  const v = raw.trim();
  if (v === '') return undefined;
  if (NO_WORKSHOP_RE.test(v) || CREW_RE.test(v)) return null;
  return v;
}

/** Crew in at least one slot and no real workshop in the other. */
function isCrewRow(raw1: string | undefined, raw2: string | undefined): boolean {
  const vals = [raw1, raw2].map((v) => (v ?? '').trim());
  const real = vals.some((v) => v !== '' && !NO_WORKSHOP_RE.test(v) && !CREW_RE.test(v));
  return !real && vals.some((v) => CREW_RE.test(v));
}

function textOrNull(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const v = raw.trim();
  return v === '' ? null : v;
}

export function buildRows(
  headers: string[],
  records: Array<{ line: number; values: string[] }>
): { rows: ParsedRow[]; errors: RowError[]; unknownHeaders: string[] } {
  const mapped = headers.map((h) => COLUMN_MAPPING[normalizeHeader(h)] ?? null);
  const unknownHeaders = headers.filter((_, i) => mapped[i] === null);
  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];

  for (const rec of records) {
    const r: Record<string, string> = {};
    mapped.forEach((key, i) => {
      if (key && rec.values[i] !== undefined) r[key] = rec.values[i].trim();
    });
    const studentName =
      r.student_name || [r.first_name, r.last_name].filter(Boolean).join(' ').trim();
    const supervisorName =
      r.supervisor_name || [r.supervisor_first_name, r.supervisor_last_name].filter(Boolean).join(' ').trim();

    const missing: string[] = [];
    if (!r.registration_id) missing.push('registration_id');
    if (!studentName) missing.push('student_name');
    if (!r.supervisor_email) missing.push('supervisor_email');
    if (missing.length) {
      errors.push({ line: rec.line, registration_id: r.registration_id, message: `Missing ${missing.join(', ')}` });
      continue;
    }

    rows.push({
      line: rec.line,
      registration_id: r.registration_id,
      student_name: studentName,
      supervisor_name: supervisorName || null,
      supervisor_email: r.supervisor_email.toLowerCase(),
      workshop_slot1_name: slotValue(r.workshop_slot1_name),
      workshop_slot2_name: slotValue(r.workshop_slot2_name),
      room_location: textOrNull(r.room_location),
      notes: textOrNull(r.notes),
      crew: isCrewRow(r.workshop_slot1_name, r.workshop_slot2_name),
    });
  }
  return { rows, errors, unknownHeaders };
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export function normalizeWorkshopName(name: string): string {
  return name
    .normalize('NFC')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function workshopKey(name: string, slot: 1 | 2): string {
  return `${slot}|${normalizeWorkshopName(name).toLowerCase()}`;
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export function computeImportPlan(
  rows: ParsedRow[],
  rowErrors: RowError[],
  existingStudents: ExistingStudent[],
  existingWorkshops: ExistingWorkshop[]
): ImportPlan {
  const warnings: string[] = [];
  const errors: RowError[] = [...rowErrors];

  // Duplicate registration ids inside the CSV: last one wins, warn.
  const seen = new Map<string, number>();
  for (const r of rows) {
    const prev = seen.get(r.registration_id);
    if (prev !== undefined) warnings.push(`Registration ID ${r.registration_id} appears on lines ${prev} and ${r.line}; the later row wins.`);
    seen.set(r.registration_id, r.line);
  }
  const dedupedRows = Array.from(new Map(rows.map((r) => [r.registration_id, r])).values());

  // Workshops referenced by the CSV.
  const existingByKey = new Map<string, ExistingWorkshop>();
  for (const w of existingWorkshops) existingByKey.set(workshopKey(w.workshop_name, w.time_slot as 1 | 2), w);

  const refs = new Map<string, { name: string; slot: 1 | 2; room: string | null; count: number; variants: Set<string> }>();
  const addRef = (name: string, slot: 1 | 2, room: string | null) => {
    const key = workshopKey(name, slot);
    const cur = refs.get(key);
    if (cur) {
      cur.count++;
      cur.variants.add(name);
      if (!cur.room && room) cur.room = room;
    } else {
      refs.set(key, { name: normalizeWorkshopName(name), slot, room, count: 1, variants: new Set([name]) });
    }
  };
  for (const r of dedupedRows) {
    if (typeof r.workshop_slot1_name === 'string') addRef(r.workshop_slot1_name, 1, r.room_location);
    if (typeof r.workshop_slot2_name === 'string') addRef(r.workshop_slot2_name, 2, r.room_location);
  }

  const workshops: WorkshopPlanItem[] = [];
  for (const [key, ref] of refs) {
    if (ref.variants.size > 1) {
      warnings.push(`Workshop "${ref.name}" (slot ${ref.slot}) is spelled ${ref.variants.size} ways in the CSV: ${Array.from(ref.variants).map((v) => `"${v}"`).join(', ')}. Treated as one workshop.`);
    }
    const existing = existingByKey.get(key);
    if (existing) {
      const roomChanges = !!ref.room && ref.room !== (existing.room_location ?? '');
      workshops.push({
        key,
        name: existing.workshop_name,
        time_slot: ref.slot,
        action: roomChanges ? 'update_room' : 'match',
        id: existing.id,
        room_before: existing.room_location,
        room_after: roomChanges ? ref.room : existing.room_location,
        student_count: ref.count,
      });
    } else {
      workshops.push({
        key,
        name: ref.name,
        time_slot: ref.slot,
        action: 'create',
        id: null,
        room_before: null,
        room_after: ref.room,
        student_count: ref.count,
      });
    }
  }
  workshops.sort((a, b) => a.time_slot - b.time_slot || a.name.localeCompare(b.name));

  // Students.
  const existingByReg = new Map(existingStudents.map((s) => [s.registration_id, s]));
  const workshopNameById = new Map(existingWorkshops.map((w) => [w.id, w.workshop_name]));
  const students: StudentPlanItem[] = [];

  const slotPlan = (value: SlotValue, slot: 1 | 2, currentId: string | null, isNew: boolean) => {
    if (value === undefined) {
      // blank: leave unchanged (null for new student)
      return { set: isNew, workshopKey: null as string | null, after: isNew ? null : currentId, changed: false };
    }
    if (value === null) {
      return { set: true, workshopKey: null as string | null, after: null, changed: currentId !== null };
    }
    const key = workshopKey(value, slot);
    const existing = existingByKey.get(key);
    const afterId = existing ? existing.id : `create:${key}`;
    return { set: true, workshopKey: key, after: afterId, changed: afterId !== currentId };
  };

  for (const r of dedupedRows) {
    const ex = existingByReg.get(r.registration_id);
    const isNew = !ex;
    const s1 = slotPlan(r.workshop_slot1_name, 1, ex?.workshop_slot1_id ?? null, isNew);
    const s2 = slotPlan(r.workshop_slot2_name, 2, ex?.workshop_slot2_id ?? null, isNew);

    const describeSlot = (id: string | null) =>
      id === null ? null : workshopNameById.get(id) ?? (id.startsWith('create:') ? `${id.slice(7).split('|')[1]} (new)` : id);

    const values: StudentPlanItem['values'] = {
      student_name: r.student_name,
      supervisor_name: r.supervisor_name,
      supervisor_email: r.supervisor_email,
      notes: r.notes ?? ex?.notes ?? null, // blank notes: keep existing
      workshop_slot1: { set: s1.set, workshopKey: s1.workshopKey },
      workshop_slot2: { set: s2.set, workshopKey: s2.workshopKey },
    };

    if (isNew && r.crew) continue; // crew are never added
    if (isNew) {
      students.push({ registration_id: r.registration_id, student_name: r.student_name, action: 'create', id: null, changes: [], values });
      continue;
    }

    const changes: FieldChange[] = [];
    const cmp = (field: string, before: string | null, after: string | null) => {
      if ((before ?? '') !== (after ?? '')) changes.push({ field, before, after });
    };
    cmp('student_name', ex.student_name, r.student_name);
    cmp('supervisor_name', ex.supervisor_name, r.supervisor_name);
    cmp('supervisor_email', ex.supervisor_email, r.supervisor_email);
    cmp('notes', ex.notes, values.notes);
    if (s1.changed) changes.push({ field: 'workshop_slot1', before: describeSlot(ex.workshop_slot1_id), after: describeSlot(s1.after) });
    if (s2.changed) changes.push({ field: 'workshop_slot2', before: describeSlot(ex.workshop_slot2_id), after: describeSlot(s2.after) });
    if (r.crew) {
      if (!ex.not_attending) changes.push({ field: 'not_attending', before: 'Attending', after: 'Not attending (crew)' });
    } else if (ex.not_attending) {
      // Back in the CSV means back on the expected list.
      changes.push({ field: 'not_attending', before: 'Not attending', after: 'Attending' });
    }

    students.push({
      registration_id: r.registration_id,
      student_name: r.student_name,
      action: changes.length ? 'update' : 'unchanged',
      id: ex.id,
      changes,
      values,
    });
  }

  const csvRegs = new Set(dedupedRows.map((r) => r.registration_id));
  const missingFromCsv = existingStudents
    .filter((s) => !csvRegs.has(s.registration_id))
    .map((s) => ({ id: s.id, registration_id: s.registration_id, student_name: s.student_name, not_attending: !!s.not_attending }));

  const crewRows = dedupedRows.filter((r) => r.crew).length;
  if (crewRows > 0) warnings.push(`${crewRows} crew row(s) (Stage Crew / Video Crew) are kept out of workshops, counts and emails.`);

  const blankSlots = dedupedRows.filter((r) => r.workshop_slot1_name === undefined || r.workshop_slot2_name === undefined).length;
  if (blankSlots > 0) warnings.push(`${blankSlots} row(s) have a blank workshop cell; existing assignments for those students are kept as-is.`);

  const summary = {
    rows: dedupedRows.length,
    studentsCreate: students.filter((s) => s.action === 'create').length,
    studentsUpdate: students.filter((s) => s.action === 'update').length,
    studentsUnchanged: students.filter((s) => s.action === 'unchanged').length,
    workshopsCreate: workshops.filter((w) => w.action === 'create').length,
    workshopsMatch: workshops.filter((w) => w.action !== 'create').length,
    roomUpdates: workshops.filter((w) => w.action === 'update_room').length,
    missingFromCsv: missingFromCsv.length,
  };

  return { workshops, students, missingFromCsv, warnings, errors, summary };
}
