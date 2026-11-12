/**
 * Workshop Detail Page
 * Detailed view of workshop attendance with student roster
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Workshop, Student, Attendance } from '@/lib/types';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Download, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { toCsv } from '@/lib/csv';

interface WorkshopDetailProps {
  params: { id: string };
}

interface StudentAttendance extends Student {
  /** Flagged not attending and never scanned: listed but not counted. */
  excused: boolean;
  attendance: Attendance | null;
  has_attended: boolean;
  is_wrong_workshop: boolean;
}

export default function WorkshopDetailPage({ params }: WorkshopDetailProps) {
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkshopDetail();
  }, [params.id]);

  const loadWorkshopDetail = async () => {
    try {
      const supabase = createClient();

      // Load workshop
      const { data: workshopData } = await supabase
        .from('workshops')
        .select('*')
        .eq('id', params.id)
        .single();

      if (!workshopData) {
        toast.error('Workshop not found');
        setLoading(false);
        return;
      }

      setWorkshop(workshopData);

      // Load all students registered for this workshop (scoped to the workshop's event)
      const { data: registeredStudents } = await supabase
        .from('students')
        .select('*')
        .eq('event_id', workshopData.event_id)
        .or(`workshop_slot1_id.eq.${params.id},workshop_slot2_id.eq.${params.id}`)
        .order('student_name');

      // Load attendance for this workshop
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('workshop_id', params.id);

      if (!registeredStudents || !attendance) {
        setLoading(false);
        return;
      }

      // Get student IDs from attendance to include students checked into wrong workshop
      const attendanceStudentIds = new Set(attendance.map((a) => a.student_id));
      const registeredStudentIds = new Set(registeredStudents.map((s) => s.id));

      // Find students who have attendance records but aren't registered for this workshop
      let wrongWorkshopStudents: Student[] = [];
      const missingStudentIds = Array.from(attendanceStudentIds).filter(
        (id) => !registeredStudentIds.has(id)
      );

      if (missingStudentIds.length > 0) {
        const { data: wrongWorkshopData } = await supabase
          .from('students')
          .select('*')
          .in('id', missingStudentIds)
          .order('student_name');

        if (wrongWorkshopData) {
          wrongWorkshopStudents = wrongWorkshopData;
        }
      }

      // Not-attending students with no scan anywhere are excused: shown, but not counted
      // as registered or absent (same rule as lib/stats.ts expectedStudents).
      const flaggedIds = registeredStudents.filter((s) => s.not_attending).map((s) => s.id);
      const scannedSomewhere = new Set<string>();
      if (flaggedIds.length > 0) {
        const { data: flaggedScans } = await supabase.from('attendance').select('student_id').in('student_id', flaggedIds);
        for (const row of flaggedScans || []) scannedSomewhere.add(row.student_id);
      }

      // Combine all students for display (registered + wrong workshop)
      const allStudentsData = [...registeredStudents, ...wrongWorkshopStudents];

      // Combine student data with attendance and track registration status
      const studentAttendance: StudentAttendance[] = allStudentsData.map((student) => {
        const attendanceRecord = attendance.find(
          (a) => a.student_id === student.id
        );
        const isRegistered = registeredStudentIds.has(student.id);

        return {
          ...student,
          attendance: attendanceRecord || null,
          has_attended: !!attendanceRecord,
          excused: !!student.not_attending && !scannedSomewhere.has(student.id),
          is_wrong_workshop: attendanceRecord && !isRegistered
            ? true
            : attendanceRecord
            ? !attendanceRecord.is_correct_workshop
            : false,
        };
      });

      setStudents(studentAttendance);
      setLoading(false);
    } catch (error) {
      console.error('Error loading workshop:', error);
      toast.error('Failed to load workshop details');
      setLoading(false);
    }
  };

  const manualCheckIn = async (studentId: string) => {
    if (!workshop) return;

    try {
      const supabase = createClient();

      // Same path as the phones: earliest scan wins, duplicates are reported not errored.
      const { data, error } = await supabase.rpc('upsert_attendance', {
        rows: [
          {
            id: crypto.randomUUID(),
            student_id: studentId,
            workshop_id: workshop.id,
            scanned_at: new Date().toISOString(),
            scanner_device_id: 'admin-dashboard',
            is_correct_workshop: true,
            manually_added: true,
          },
        ],
      });

      if (error) {
        console.error('Error creating attendance:', error);
        toast.error('Failed to check in student');
        return;
      }

      const result = (data as Array<{ status: string; detail: string | null }> | null)?.[0];
      if (!result || result.status === 'error') {
        toast.error(`Failed to check in student${result?.detail ? `: ${result.detail}` : ''}`);
        return;
      }
      if (result.status === 'inserted') {
        toast.success('Student checked in manually');
      } else {
        toast('Student was already checked in (earlier scan kept)', { icon: 'ℹ️' });
      }
      loadWorkshopDetail(); // Reload data
    } catch (error) {
      console.error('Error checking in student:', error);
      toast.error('Failed to check in student');
    }
  };

  const exportToCSV = () => {
    if (!workshop) return;

    const headers = [
      'Student Name',
      'Registration ID',
      'Supervisor',
      'Status',
      'Scanned At',
      'Scanner Device',
      'Notes',
    ];

    const rows = students.map((student) => [
      student.student_name,
      student.registration_id,
      student.supervisor_name || '',
      student.has_attended ? 'Present' : student.excused ? 'Not attending' : 'Absent',
      student.attendance
        ? format(new Date(student.attendance.scanned_at), 'MMM d, yyyy h:mm a')
        : '',
      student.attendance?.scanner_device_id || '',
      student.is_wrong_workshop ? 'Wrong Workshop' : '',
    ]);

    const csv = toCsv([headers, ...rows]);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workshop.workshop_name.replace(/\s+/g, '_')}_attendance.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success('Exported to CSV');
  };

  if (loading || !workshop) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-600">Loading workshop details...</p>
      </div>
    );
  }

  // Separate registered and wrong workshop students
  const registeredOnly = students.filter((s) => !s.is_wrong_workshop && !s.excused);
  const wrongWorkshopOnly = students.filter((s) => s.is_wrong_workshop);

  const stats = {
    registered: registeredOnly.length,
    attended: students.filter((s) => s.has_attended).length,
    absent: registeredOnly.filter((s) => !s.has_attended).length,
    wrong_workshop: wrongWorkshopOnly.length,
  };

  const attendanceRate =
    stats.registered > 0 ? (stats.attended / stats.registered) * 100 : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center text-primary hover:text-primary-dark mb-4"
        >
          <ArrowLeft size={20} className="mr-2" />
          Back to Dashboard
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {workshop.workshop_name}
            </h1>
            <div className="flex items-center space-x-4 text-gray-600">
              <span>Time Slot {workshop.time_slot}</span>
              {workshop.room_location && (
                <>
                  <span>•</span>
                  <span>{workshop.room_location}</span>
                </>
              )}
              {workshop.capacity && (
                <>
                  <span>•</span>
                  <span>Capacity: {workshop.capacity}</span>
                </>
              )}
            </div>
          </div>

          <button
            onClick={exportToCSV}
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            <Download size={18} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">
            Registered
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.registered}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Present</div>
          <div className="text-3xl font-bold text-green-600">
            {stats.attended}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {attendanceRate.toFixed(1)}%
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">Absent</div>
          <div className="text-3xl font-bold text-gray-600">{stats.absent}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-600 mb-2">
            Wrong Workshop
          </div>
          <div className="text-3xl font-bold text-orange-600">
            {stats.wrong_workshop}
          </div>
        </div>
      </div>

      {/* Student Roster */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Student Roster
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registration ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supervisor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scanned At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {student.student_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {student.registration_id}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {student.supervisor_name || '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {student.has_attended ? (
                      <div className="flex items-center">
                        <CheckCircle
                          size={16}
                          className="text-green-600 mr-2"
                        />
                        <span className="text-sm text-green-600 font-medium">
                          Present
                        </span>
                        {student.is_wrong_workshop && (
                          <div className="relative group ml-2">
                            <AlertTriangle
                              size={16}
                              className="text-orange-600 cursor-help"
                            />
                            <div className="invisible group-hover:visible absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-10">
                              Checked into wrong workshop
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <XCircle size={16} className="text-gray-400 mr-2" />
                        <span className="text-sm text-gray-500">{student.excused ? 'Not attending' : 'Absent'}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {student.attendance
                        ? format(
                            new Date(student.attendance.scanned_at),
                            'h:mm a'
                          )
                        : '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {!student.has_attended ? (
                      <button
                        onClick={() => manualCheckIn(student.id)}
                        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors"
                      >
                        <UserPlus size={14} className="mr-1" />
                        Check In
                      </button>
                    ) : student.attendance?.manually_added ? (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded">
                        Manual
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {students.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No students registered for this workshop</p>
          </div>
        )}
      </div>
    </div>
  );
}
