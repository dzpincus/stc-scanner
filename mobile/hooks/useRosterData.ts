/**
 * React Query hooks for roster data
 * Provides reactive data fetching with automatic cache invalidation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as db from '../lib/database';
import { Student, Attendance } from '../lib/types';

export type StudentWithAttendance = Student & {
  hasAttended: boolean;
  attendance: Attendance | null;
};

/**
 * Hook to fetch roster data for a workshop
 * Automatically refetches when workshop changes
 */
export function useRosterData(workshopId: string | null) {
  return useQuery({
    queryKey: ['roster', workshopId],
    queryFn: async (): Promise<StudentWithAttendance[]> => {
      if (!workshopId) return [];

      // Get all students registered for this workshop
      const registeredStudents = await db.getStudentsByWorkshop(workshopId);

      // Get attendance records
      const attendanceRecords = await db.getAttendanceByWorkshop(workshopId);

      // Create a map of student ID to attendance
      const attendanceMap = new Map<string, Attendance>();
      attendanceRecords.forEach((a) => {
        attendanceMap.set(a.student_id, a);
      });

      // Combine student data with attendance
      return registeredStudents.map((student) => {
        const attendance = attendanceMap.get(student.id) || null;
        return {
          ...student,
          hasAttended: attendance !== null,
          attendance,
        };
      });
    },
    enabled: !!workshopId,
    staleTime: 0, // Always refetch when component mounts
    refetchOnMount: 'always',
  });
}

/**
 * Hook to get workshop statistics
 */
export function useWorkshopStats(workshopId: string | null) {
  return useQuery({
    queryKey: ['workshop-stats', workshopId],
    queryFn: async () => {
      if (!workshopId) {
        return { total: 0, present: 0, absent: 0, percentage: 0 };
      }

      const students = await db.getStudentsByWorkshop(workshopId);
      const attendance = await db.getAttendanceByWorkshop(workshopId);

      const total = students.length;
      const present = attendance.length;
      const absent = total - present;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

      return { total, present, absent, percentage };
    },
    enabled: !!workshopId,
    staleTime: 0,
  });
}

/**
 * Hook to invalidate roster data after sync or attendance changes
 * Forces immediate refetch of roster and stats
 */
export function useInvalidateRoster() {
  const queryClient = useQueryClient();

  return async () => {
    // Force immediate refetch of both queries
    await Promise.all([
      queryClient.refetchQueries({ queryKey: ['roster'] }),
      queryClient.refetchQueries({ queryKey: ['workshop-stats'] }),
    ]);
  };
}
