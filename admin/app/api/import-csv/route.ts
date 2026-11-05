/**
 * CSV Import API Route
 *
 * Two-phase: POST with dryRun=1 returns a plan (diff against the active event) and writes nothing.
 * POST with dryRun=0 applies that plan. Refused while the active event is locked (doors open).
 *
 * Scoped to the active event. Existing workshop rooms are never blanked, blank workshop cells
 * leave assignments unchanged, students missing from the CSV are reported but never deleted.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getAuthenticatedUser } from '@/lib/supabase-server';
import { getActiveEvent } from '@/lib/event';
import {
  parseCsv,
  buildRows,
  computeImportPlan,
  type ExistingStudent,
  type ExistingWorkshop,
  type ImportPlan,
} from '@/lib/csv-import';

export interface ImportResponse {
  dryRun: boolean;
  event: { id: string; slug: string; name: string; locked: boolean };
  plan: ImportPlan;
  applied?: {
    workshopsCreated: number;
    roomsUpdated: number;
    studentsCreated: number;
    studentsUpdated: number;
    failures: Array<{ registration_id?: string; workshop?: string; message: string }>;
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const dryRun = formData.get('dryRun') !== '0';

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const event = await getActiveEvent(supabase);
    if (!event) {
      return NextResponse.json({ error: 'No active event configured' }, { status: 500 });
    }
    if (!dryRun && event.locked) {
      return NextResponse.json(
        { error: `Event "${event.name}" is locked (event mode). Unlock it on the dashboard before importing.` },
        { status: 423 }
      );
    }

    const text = await file.text();
    const { headers, records } = parseCsv(text);
    if (headers.length === 0 || records.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 });
    }
    const { rows, errors: rowErrors, unknownHeaders } = buildRows(headers, records);
    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: `No valid rows. Headers seen: ${headers.join(', ')}. Required: registration_id (or "Registrant ID"), student_name (or first/last name), supervisor_email (or "Contact Email").`,
        },
        { status: 400 }
      );
    }

    const [{ data: existingStudents, error: sErr }, { data: existingWorkshops, error: wErr }] = await Promise.all([
      supabase
        .from('students')
        .select('id, registration_id, student_name, supervisor_name, supervisor_email, workshop_slot1_id, workshop_slot2_id, notes')
        .eq('event_id', event.id),
      supabase.from('workshops').select('id, workshop_name, time_slot, room_location').eq('event_id', event.id),
    ]);
    if (sErr || wErr) {
      throw sErr || wErr;
    }

    const plan = computeImportPlan(
      rows,
      rowErrors,
      (existingStudents || []) as ExistingStudent[],
      (existingWorkshops || []) as ExistingWorkshop[]
    );
    if (unknownHeaders.length) {
      plan.warnings.unshift(`Ignored unrecognized column(s): ${unknownHeaders.join(', ')}`);
    }

    console.log(
      `[Import] event=${event.slug} dryRun=${dryRun} rows=${plan.summary.rows} create=${plan.summary.studentsCreate} update=${plan.summary.studentsUpdate} unchanged=${plan.summary.studentsUnchanged} newWorkshops=${plan.summary.workshopsCreate} errors=${plan.errors.length}`
    );

    const eventInfo = { id: event.id, slug: event.slug, name: event.name, locked: event.locked };
    if (dryRun) {
      return NextResponse.json({ dryRun: true, event: eventInfo, plan } satisfies ImportResponse);
    }

    // ---------------------------------------------------------------- apply
    const failures: NonNullable<ImportResponse['applied']>['failures'] = [];
    const idByKey = new Map<string, string>();
    for (const w of plan.workshops) if (w.id) idByKey.set(w.key, w.id);

    // 1. Create missing workshops.
    const toCreate = plan.workshops.filter((w) => w.action === 'create');
    let workshopsCreated = 0;
    if (toCreate.length) {
      const { data, error } = await supabase
        .from('workshops')
        .insert(
          toCreate.map((w) => ({
            event_id: event.id,
            workshop_name: w.name,
            time_slot: w.time_slot,
            room_location: w.room_after,
          }))
        )
        .select('id, workshop_name, time_slot');
      if (error) {
        failures.push({ message: `Creating workshops failed: ${error.message}` });
      } else {
        for (const created of data || []) {
          const match = toCreate.find((w) => w.name === created.workshop_name && w.time_slot === created.time_slot);
          if (match) idByKey.set(match.key, created.id);
        }
        workshopsCreated = data?.length || 0;
      }
    }

    // 2. Room updates (only where the CSV supplied a non-empty, different room).
    let roomsUpdated = 0;
    for (const w of plan.workshops.filter((x) => x.action === 'update_room' && x.id)) {
      const { error } = await supabase.from('workshops').update({ room_location: w.room_after }).eq('id', w.id!);
      if (error) failures.push({ workshop: w.name, message: `Room update failed: ${error.message}` });
      else roomsUpdated++;
    }

    const resolveSlot = (slot: { set: boolean; workshopKey: string | null }) => {
      if (!slot.set) return undefined;
      if (slot.workshopKey === null) return null;
      return idByKey.get(slot.workshopKey) ?? null;
    };

    // 3. New students in one insert.
    const creates = plan.students.filter((s) => s.action === 'create');
    let studentsCreated = 0;
    if (creates.length) {
      const payload = creates.map((s) => ({
        event_id: event.id,
        registration_id: s.registration_id,
        student_name: s.values.student_name,
        supervisor_name: s.values.supervisor_name,
        supervisor_email: s.values.supervisor_email,
        notes: s.values.notes,
        workshop_slot1_id: resolveSlot(s.values.workshop_slot1) ?? null,
        workshop_slot2_id: resolveSlot(s.values.workshop_slot2) ?? null,
      }));
      const { data, error } = await supabase.from('students').insert(payload).select('id');
      if (error) failures.push({ message: `Creating ${creates.length} students failed: ${error.message}` });
      else studentsCreated = data?.length || 0;
    }

    // 4. Changed students one by one, only touching the fields that changed.
    let studentsUpdated = 0;
    for (const s of plan.students.filter((x) => x.action === 'update' && x.id)) {
      const patch: Record<string, string | null> = {};
      for (const c of s.changes) {
        if (c.field === 'workshop_slot1') patch.workshop_slot1_id = resolveSlot(s.values.workshop_slot1) ?? null;
        else if (c.field === 'workshop_slot2') patch.workshop_slot2_id = resolveSlot(s.values.workshop_slot2) ?? null;
        else if (c.field === 'student_name') patch.student_name = s.values.student_name;
        else if (c.field === 'supervisor_name') patch.supervisor_name = s.values.supervisor_name;
        else if (c.field === 'supervisor_email') patch.supervisor_email = s.values.supervisor_email;
        else if (c.field === 'notes') patch.notes = s.values.notes;
      }
      const { error } = await supabase.from('students').update(patch).eq('id', s.id!);
      if (error) failures.push({ registration_id: s.registration_id, message: error.message });
      else studentsUpdated++;
    }

    console.log(
      `[Import] applied event=${event.slug} workshopsCreated=${workshopsCreated} roomsUpdated=${roomsUpdated} studentsCreated=${studentsCreated} studentsUpdated=${studentsUpdated} failures=${failures.length}`
    );

    return NextResponse.json({
      dryRun: false,
      event: eventInfo,
      plan,
      applied: { workshopsCreated, roomsUpdated, studentsCreated, studentsUpdated, failures },
    } satisfies ImportResponse);
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import CSV' },
      { status: 500 }
    );
  }
}
