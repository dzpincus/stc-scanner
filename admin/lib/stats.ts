/**
 * Attendance arithmetic shared by the dashboard and the workshops list.
 *
 * attended  = scans at the workshop by students registered for it (is_correct_workshop)
 * wrong     = scans at the workshop by students registered elsewhere (walk-ins)
 * absent    = registered - attended, never negative
 * rate      = attended / registered
 *
 * Walk-ins are reported separately and never inflate attended or shrink absent.
 */

import type { Attendance, Student, Workshop, WorkshopStats } from './types';

type Counts = { attended: number; wrong: number };

export function computeWorkshopStats(
  workshops: Workshop[],
  students: Student[],
  attendance: Attendance[]
): WorkshopStats[] {
  const registered = new Map<string, number>();
  for (const s of students) {
    if (s.workshop_slot1_id) registered.set(s.workshop_slot1_id, (registered.get(s.workshop_slot1_id) || 0) + 1);
    if (s.workshop_slot2_id) registered.set(s.workshop_slot2_id, (registered.get(s.workshop_slot2_id) || 0) + 1);
  }

  const scans = new Map<string, Counts>();
  for (const a of attendance) {
    const c = scans.get(a.workshop_id) || { attended: 0, wrong: 0 };
    if (a.is_correct_workshop) c.attended++;
    else c.wrong++;
    scans.set(a.workshop_id, c);
  }

  return workshops.map((w) => {
    const reg = registered.get(w.id) || 0;
    const { attended, wrong } = scans.get(w.id) || { attended: 0, wrong: 0 };
    return {
      id: w.id,
      workshop_name: w.workshop_name,
      time_slot: w.time_slot,
      room_location: w.room_location,
      description: w.description,
      capacity: w.capacity,
      registered: reg,
      attended,
      absent: Math.max(0, reg - attended),
      wrong_workshop: wrong,
      attendance_rate: reg > 0 ? (attended / reg) * 100 : 0,
    };
  });
}

export interface SlotSummary {
  registered: number;
  attended: number;
  absent: number;
  wrongWorkshop: number;
  rate: number;
}

export function summarizeSlot(stats: WorkshopStats[]): SlotSummary {
  const registered = stats.reduce((n, s) => n + s.registered, 0);
  const attended = stats.reduce((n, s) => n + s.attended, 0);
  const absent = stats.reduce((n, s) => n + s.absent, 0);
  const wrongWorkshop = stats.reduce((n, s) => n + s.wrong_workshop, 0);
  return { registered, attended, absent, wrongWorkshop, rate: registered > 0 ? (attended / registered) * 100 : 0 };
}
