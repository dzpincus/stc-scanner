import { describe, it, expect } from 'vitest';
import { parseCsv, buildRows, computeImportPlan, workshopKey, type ExistingStudent, type ExistingWorkshop } from './csv-import';

const W1: ExistingWorkshop = { id: 'w1', workshop_name: 'F 2: Short-Form Storytelling', time_slot: 1, room_location: 'Kahn 101' };
const W2: ExistingWorkshop = { id: 'w2', workshop_name: 'TH 5: Is Speech Really Free', time_slot: 2, room_location: null };
const S1: ExistingStudent = {
  id: 's1', registration_id: 'R1', student_name: 'Alice A', supervisor_name: 'Sup One',
  supervisor_email: 'one@school.org', workshop_slot1_id: 'w1', workshop_slot2_id: 'w2', notes: 'vegan',
};
const S9: ExistingStudent = {
  id: 's9', registration_id: 'R9', student_name: 'Zed Z', supervisor_name: null,
  supervisor_email: 'nine@school.org', workshop_slot1_id: null, workshop_slot2_id: null, notes: null,
};

function plan(csv: string, students = [S1, S9], workshops = [W1, W2]) {
  const { headers, records } = parseCsv(csv);
  const { rows, errors } = buildRows(headers, records);
  return computeImportPlan(rows, errors, students, workshops);
}

describe('parseCsv', () => {
  it('strips BOM, handles CRLF, quotes, doubled quotes and embedded newlines', () => {
    const csv = '﻿Registrant ID,Name (First Name),Name (Last Name),Contact Email,Breakout Session I\r\n' +
      'R1,"Alice, Jr.",A,one@school.org,"He said ""hi""\nthen left"\r\n';
    const { headers, records } = parseCsv(csv);
    expect(headers[0]).toBe('Registrant ID');
    expect(records).toHaveLength(1);
    expect(records[0].values).toEqual(['R1', 'Alice, Jr.', 'A', 'one@school.org', 'He said "hi"\nthen left']);
  });

  it('skips blank lines and reports source line numbers', () => {
    const { records } = parseCsv('a,b\n\n1,2\n\n3,4\n');
    expect(records.map((r) => r.line)).toEqual([3, 5]);
  });
});

describe('buildRows', () => {
  it('maps the registration-system headers and combines names', () => {
    const { rows, errors } = buildRows(
      ['Registrant ID', 'Name (First Name)', 'Name (Last Name)', 'Contact First Name', 'Contact Last Name', 'Contact Email', 'Breakout Session I', 'Breakout Session II'],
      [{ line: 2, values: ['R1', 'Alice', 'A', 'Sup', 'One', 'ONE@School.org', 'F 2:  Short-Form Storytelling', 'No Workshop'] }]
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      registration_id: 'R1', student_name: 'Alice A', supervisor_name: 'Sup One', supervisor_email: 'one@school.org',
      workshop_slot1_name: 'F 2:  Short-Form Storytelling', workshop_slot2_name: null,
    });
  });

  it('treats blank workshop cells as undefined (unchanged) and reports missing required fields', () => {
    const { rows, errors } = buildRows(
      ['registration_id', 'student_name', 'supervisor_email', 'workshop_slot1_name'],
      [
        { line: 2, values: ['R1', 'Alice', 'one@school.org', ''] },
        { line: 3, values: ['', 'Nobody', 'x@y.z', 'W'] },
      ]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].workshop_slot1_name).toBeUndefined();
    expect(rows[0].workshop_slot2_name).toBeUndefined();
    expect(errors).toEqual([{ line: 3, registration_id: '', message: 'Missing registration_id' }]);
  });
});

describe('workshopKey', () => {
  it('ignores case, extra whitespace and curly quotes', () => {
    expect(workshopKey('F 2:  Short-Form', 1)).toBe(workshopKey('f 2: short-form', 1));
    expect(workshopKey('Don’t Stop', 2)).toBe(workshopKey("don't stop", 2));
    expect(workshopKey('Same Name', 1)).not.toBe(workshopKey('Same Name', 2));
  });
});

describe('computeImportPlan', () => {
  const HEADER = 'registration_id,student_name,supervisor_name,supervisor_email,workshop_slot1_name,workshop_slot2_name,room_location\n';

  it('reports an identical re-import as unchanged and lists students missing from the CSV', () => {
    const p = plan(HEADER + 'R1,Alice A,Sup One,one@school.org,F 2: Short-Form Storytelling,TH 5: Is Speech Really Free,\n');
    expect(p.summary).toMatchObject({ studentsCreate: 0, studentsUpdate: 0, studentsUnchanged: 1, workshopsCreate: 0, workshopsMatch: 2, roomUpdates: 0, missingFromCsv: 1 });
    expect(p.missingFromCsv[0].registration_id).toBe('R9');
  });

  it('matches workshops despite whitespace/case drift instead of creating duplicates', () => {
    const p = plan(HEADER + 'R1,Alice A,Sup One,one@school.org,f 2:  short-form storytelling,TH 5: IS SPEECH REALLY FREE,\n');
    expect(p.summary.workshopsCreate).toBe(0);
    expect(p.students[0].action).toBe('unchanged');
  });

  it('never blanks an existing room, but applies a non-empty different room', () => {
    const kept = plan(HEADER + 'R1,Alice A,Sup One,one@school.org,F 2: Short-Form Storytelling,,\n');
    expect(kept.workshops.find((w) => w.id === 'w1')).toMatchObject({ action: 'match', room_after: 'Kahn 101' });

    const changed = plan(HEADER + 'R1,Alice A,Sup One,one@school.org,F 2: Short-Form Storytelling,,Kahn 202\n');
    expect(changed.workshops.find((w) => w.id === 'w1')).toMatchObject({ action: 'update_room', room_before: 'Kahn 101', room_after: 'Kahn 202' });
  });

  it('keeps assignments on blank cells, clears on "No Workshop", and diffs real changes', () => {
    const p = plan(HEADER + 'R1,Alice B,Sup One,one@school.org,,No Workshop,\n');
    const s = p.students[0];
    expect(s.action).toBe('update');
    expect(s.changes.map((c) => c.field).sort()).toEqual(['student_name', 'workshop_slot2']);
    expect(s.values.workshop_slot1.set).toBe(false);
    expect(s.values.workshop_slot2).toEqual({ set: true, workshopKey: null });
    expect(s.values.notes).toBe('vegan'); // blank notes keep existing
  });

  it('creates new students and new workshops, resolving slots to create keys', () => {
    const p = plan(HEADER + 'R2,Bob B,,two@school.org,Brand New Workshop,F 2: Short-Form Storytelling,Room 9\n');
    // slot 2 name exists in the DB only as a slot-1 workshop, so it is a new slot-2 workshop too
    expect(p.summary).toMatchObject({ studentsCreate: 1, workshopsCreate: 2 });
    const created = p.workshops.find((w) => w.action === 'create' && w.time_slot === 1)!;
    expect(created).toMatchObject({ name: 'Brand New Workshop', time_slot: 1, room_after: 'Room 9' });
    expect(p.students[0].values.workshop_slot1).toEqual({ set: true, workshopKey: created.key });
    expect(p.workshops.find((w) => w.action === 'create' && w.time_slot === 2)).toMatchObject({ name: 'F 2: Short-Form Storytelling' });
  });

  it('warns on duplicate registration ids and lets the later row win', () => {
    const p = plan(HEADER + 'R1,First,Sup One,one@school.org,,,\nR1,Second,Sup One,one@school.org,,,\n');
    expect(p.warnings.some((w) => w.includes('R1'))).toBe(true);
    expect(p.students).toHaveLength(1);
    expect(p.students[0].student_name).toBe('Second');
  });

  it('never proposes deleting anyone', () => {
    const p = plan(HEADER + 'R2,Only New,,two@school.org,,,\n');
    expect(p.missingFromCsv).toHaveLength(2);
    expect(p.students.every((s) => s.action !== ('delete' as string))).toBe(true);
  });

  it('reports whether students missing from the CSV are already not attending', () => {
    const p = plan(HEADER + 'R1,Alice A,Sup One,one@school.org,F 2: Short-Form Storytelling,TH 5: Is Speech Really Free,\n', [S1, { ...S9, not_attending: true }]);
    expect(p.missingFromCsv).toEqual([{ id: 's9', registration_id: 'R9', student_name: 'Zed Z', not_attending: true }]);
  });

  it('marks a not-attending student as attending again when the CSV lists them', () => {
    const p = plan(HEADER + 'R1,Alice A,Sup One,one@school.org,F 2: Short-Form Storytelling,TH 5: Is Speech Really Free,\n', [{ ...S1, not_attending: true }, S9]);
    expect(p.students[0].action).toBe('update');
    expect(p.students[0].changes).toEqual([{ field: 'not_attending', before: 'Not attending', after: 'Attending' }]);
  });

  it('keeps crew out: never created, existing ones cleared and marked not attending, no crew workshops', () => {
    const p = plan(HEADER + 'R1,Alice A,Sup One,one@school.org,Stage Crew,Stage Crew,\nR5,New Crew,,five@school.org,Video Crew,video crew,\n');
    expect(p.summary).toMatchObject({ studentsCreate: 0, studentsUpdate: 1, workshopsCreate: 0 });
    expect(p.students).toHaveLength(1);
    expect(p.students[0].changes.map((c) => [c.field, c.after])).toEqual([
      ['workshop_slot1', null], ['workshop_slot2', null], ['not_attending', 'Not attending (crew)'],
    ]);
    expect(p.students[0].values.workshop_slot1).toEqual({ set: true, workshopKey: null });
    expect(p.warnings.some((w) => w.includes('2 crew row(s)'))).toBe(true);
  });

  it('leaves an already-cleared crew student unchanged on re-import', () => {
    const crew = { ...S1, workshop_slot1_id: null, workshop_slot2_id: null, not_attending: true };
    const p = plan(HEADER + 'R1,Alice A,Sup One,one@school.org,Stage Crew,Stage Crew,\n', [crew, S9]);
    expect(p.students[0].action).toBe('unchanged');
  });

  it('treats crew in one slot as no workshop for that slot only', () => {
    const p = plan(HEADER + 'R1,Alice A,Sup One,one@school.org,F 2: Short-Form Storytelling,Stage Crew,\n');
    expect(p.students[0].changes.map((c) => [c.field, c.after])).toEqual([['workshop_slot2', null]]);
  });
});
