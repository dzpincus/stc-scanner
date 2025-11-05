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

interface WorkshopDetailProps {
  params: { id: string };
}

interface StudentAttendance extends Student {
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

      // Load all students registered for this workshop
      const { data: allStudents } = await supabase
        .from('students')
        .select('*')
        .or(`workshop_slot1_id.eq.${params.id},workshop_slot2_id.eq.${params.id}`)
        .order('student_name');

      // Load attendance for this workshop
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('workshop_id', params.id);

      if (!allStudents || !attendance) {
        setLoading(false);
        return;
      }

      // Combine student data with attendance
      const studentAttendance: StudentAttendance[] = allStudents.map((student) => {
        const attendanceRecord = attendance.find(
          (a) => a.student_id === student.id
        );

        return {
          ...student,
          attendance: attendanceRecord || null,
          has_attended: !!attendanceRecord,
          is_wrong_workshop: attendanceRecord
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

      // Create attendance record
      const { error } = await supabase.from('attendance').insert({
        student_id: studentId,
        workshop_id: workshop.id,
        scanned_at: new Date().toISOString(),
        is_correct_workshop: true,
        manually_added: true,
        manually_overridden: false,
      });

      if (error) {
        console.error('Error creating attendance:', error);
        toast.error('Failed to check in student');
        return;
      }

      toast.success('Student checked in manually');
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
      student.has_attended ? 'Present' : 'Absent',
      student.attendance
        ? format(new Date(student.attendance.scanned_at), 'MMM d, yyyy h:mm a')
        : '',
      student.attendance?.scanner_device_id || '',
      student.is_wrong_workshop ? 'Wrong Workshop' : '',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
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

  const stats = {
    registered: students.length,
    attended: students.filter((s) => s.has_attended).length,
    absent: students.filter((s) => !s.has_attended).length,
    wrong_workshop: students.filter((s) => s.is_wrong_workshop).length,
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
                          <AlertTriangle
                            size={16}
                            className="text-orange-600 ml-2"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <XCircle size={16} className="text-gray-400 mr-2" />
                        <span className="text-sm text-gray-500">Absent</span>
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
