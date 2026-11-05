import { describe, it, expect } from 'vitest';
import { computeWorkshopStats, summarizeSlot } from './stats';
import type { Attendance, Student, Workshop } from './types';

const w = (id: string, slot: 1 | 2): Workshop =>
  ({ id, event_id: 'e', workshop_name: id, time_slot: slot, room_location: null, description: null, capacity: null, created_at: '', updated_at: '' }) as Workshop;
const s = (id: string, s1: string | null, s2: string | null): Student =>
  ({ id, event_id: 'e', registration_id: id, student_name: id, supervisor_name: null, supervisor_email: 'x@y.z', workshop_slot1_id: s1, workshop_slot2_id: s2, notes: null, created_at: '', updated_at: '' }) as Student;
const a = (student: string, workshop: string, correct: boolean): Attendance =>
  ({ id: `${student}-${workshop}`, event_id: 'e', student_id: student, workshop_id: workshop, scanned_at: '', scanner_device_id: null, is_correct_workshop: correct, manually_added: false, manually_overridden: false, checked_out_at: null, notes: null, created_at: '', updated_at: '' }) as Attendance;

describe('computeWorkshopStats', () => {
  it('counts walk-ins separately and never lets absent go negative or rate above 100', () => {
    const stats = computeWorkshopStats(
      [w('A', 1), w('B', 1)],
      [s('s1', 'A', null), s('s2', 'A', null)],
      [a('s1', 'A', true), a('s2', 'B', false), a('s3', 'B', false), a('s4', 'A', false)]
    );
    const A = stats.find((x) => x.id === 'A')!;
    const B = stats.find((x) => x.id === 'B')!;
    expect(A).toMatchObject({ registered: 2, attended: 1, absent: 1, wrong_workshop: 1, attendance_rate: 50 });
    expect(B).toMatchObject({ registered: 0, attended: 0, absent: 0, wrong_workshop: 2, attendance_rate: 0 });
  });

  it('counts a student registered in both slots once per workshop', () => {
    const stats = computeWorkshopStats([w('A', 1), w('C', 2)], [s('s1', 'A', 'C')], [a('s1', 'A', true)]);
    expect(stats.map((x) => [x.id, x.registered, x.attended])).toEqual([['A', 1, 1], ['C', 1, 0]]);
  });
});

describe('summarizeSlot', () => {
  it('uses registered as the denominator', () => {
    const stats = computeWorkshopStats([w('A', 1)], [s('s1', 'A', null), s('s2', 'A', null), s('s3', 'A', null), s('s4', 'A', null)], [a('s1', 'A', true), a('zz', 'A', false)]);
    expect(summarizeSlot(stats)).toEqual({ registered: 4, attended: 1, absent: 3, wrongWorkshop: 1, rate: 25 });
  });
});
