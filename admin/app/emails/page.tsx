/**
 * Email Management Page
 * Send attendance reports to supervisors
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { SupervisorEmailData, EmailLog } from '@/lib/types';
import { Mail, Send, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function EmailsPage() {
  const [emailPreview, setEmailPreview] = useState<SupervisorEmailData[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<1 | 2>(1);

  useEffect(() => {
    loadEmailData();
  }, [selectedSlot]);

  const loadEmailData = async () => {
    try {
      const supabase = createClient();

      // Load email logs
      const { data: logs } = await supabase
        .from('email_log')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(50);

      if (logs) {
        setEmailLogs(logs);
      }

      // Load students and attendance for preview
      const [{ data: students }, { data: workshops }, { data: attendance }] =
        await Promise.all([
          supabase.from('students').select('*'),
          supabase
            .from('workshops')
            .select('*')
            .eq('time_slot', selectedSlot),
          supabase.from('attendance').select('*, workshop:workshops(*)'),
        ]);

      if (!students || !workshops || !attendance) {
        setLoading(false);
        return;
      }

      // Group students by supervisor email
      const supervisorMap = new Map<string, SupervisorEmailData>();

      students.forEach((student) => {
        const email = student.supervisor_email;
        if (!email) return;

        if (!supervisorMap.has(email)) {
          supervisorMap.set(email, {
            supervisor_email: email,
            supervisor_name: student.supervisor_name,
            students: [],
          });
        }

        const workshopSlot1 = workshops.find(
          (w) => w.id === student.workshop_slot1_id
        );
        const workshopSlot2 = workshops.find(
          (w) => w.id === student.workshop_slot2_id
        );

        const attendedSlot1 = attendance.some(
          (a) =>
            a.student_id === student.id &&
            a.workshop_id === student.workshop_slot1_id
        );
        const attendedSlot2 = attendance.some(
          (a) =>
            a.student_id === student.id &&
            a.workshop_id === student.workshop_slot2_id
        );

        supervisorMap.get(email)!.students.push({
          student_name: student.student_name,
          registration_id: student.registration_id,
          workshop_slot1: workshopSlot1?.workshop_name || null,
          workshop_slot2: workshopSlot2?.workshop_name || null,
          attended_slot1: attendedSlot1,
          attended_slot2: attendedSlot2,
        });
      });

      setEmailPreview(Array.from(supervisorMap.values()));
      setLoading(false);
    } catch (error) {
      console.error('Error loading email data:', error);
      toast.error('Failed to load email data');
      setLoading(false);
    }
  };

  const sendEmails = async () => {
    setSending(true);
    try {
      const response = await fetch('/api/send-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeSlot: selectedSlot }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send emails');
      }

      toast.success(`Sent ${result.sent} emails successfully`);
      loadEmailData();
    } catch (error) {
      console.error('Error sending emails:', error);
      toast.error('Failed to send emails');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="animate-spin h-8 w-8 text-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading email data...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Email Management
        </h1>
        <p className="text-gray-600">
          Send attendance reports to supervisors
        </p>
      </div>

      {/* Time Slot Selection */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Select Time Slot
        </h2>
        <div className="flex space-x-4">
          <button
            onClick={() => setSelectedSlot(1)}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              selectedSlot === 1
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Time Slot 1
          </button>
          <button
            onClick={() => setSelectedSlot(2)}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              selectedSlot === 2
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Time Slot 2
          </button>
        </div>
      </div>

      {/* Email Preview */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Email Preview
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {emailPreview.length} supervisors will receive attendance reports
            </p>
          </div>
          <button
            onClick={sendEmails}
            disabled={sending || emailPreview.length === 0}
            className="flex items-center space-x-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send size={18} />
                <span>Send Emails</span>
              </>
            )}
          </button>
        </div>

        <div className="divide-y divide-gray-200">
          {emailPreview.map((supervisor, index) => (
            <div key={index} className="px-6 py-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-medium text-gray-900">
                    {supervisor.supervisor_name || 'Unknown'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {supervisor.supervisor_email}
                  </p>
                </div>
                <div className="text-sm text-gray-500">
                  {supervisor.students.length} student
                  {supervisor.students.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {supervisor.students.map((student, idx) => (
                  <div
                    key={idx}
                    className="text-sm bg-gray-50 rounded p-3 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium">{student.student_name}</span>
                      <span className="text-gray-500 ml-2">
                        ({student.registration_id})
                      </span>
                    </div>
                    <div className="flex items-center space-x-4">
                      {selectedSlot === 1 && (
                        <div className="flex items-center">
                          {student.attended_slot1 ? (
                            <CheckCircle
                              size={16}
                              className="text-green-600 mr-1"
                            />
                          ) : (
                            <XCircle size={16} className="text-gray-400 mr-1" />
                          )}
                          <span className="text-xs text-gray-600">
                            {student.workshop_slot1 || 'No workshop'}
                          </span>
                        </div>
                      )}
                      {selectedSlot === 2 && (
                        <div className="flex items-center">
                          {student.attended_slot2 ? (
                            <CheckCircle
                              size={16}
                              className="text-green-600 mr-1"
                            />
                          ) : (
                            <XCircle size={16} className="text-gray-400 mr-1" />
                          )}
                          <span className="text-xs text-gray-600">
                            {student.workshop_slot2 || 'No workshop'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {emailPreview.length === 0 && (
          <div className="text-center py-12">
            <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No supervisors found</p>
          </div>
        )}
      </div>

      {/* Email Log */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Email History</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sent At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recipient
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time Slot
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Students
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {emailLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {format(new Date(log.sent_at), 'MMM d, yyyy')}
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(log.sent_at), 'h:mm a')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {log.supervisor_email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">Slot {log.time_slot}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {log.student_count}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {log.email_status === 'sent' && (
                      <div className="flex items-center text-green-600">
                        <CheckCircle size={16} className="mr-2" />
                        <span className="text-sm font-medium">Sent</span>
                      </div>
                    )}
                    {log.email_status === 'failed' && (
                      <div className="flex items-center text-red-600">
                        <XCircle size={16} className="mr-2" />
                        <span className="text-sm font-medium">Failed</span>
                      </div>
                    )}
                    {log.email_status === 'pending' && (
                      <div className="flex items-center text-orange-600">
                        <Clock size={16} className="mr-2" />
                        <span className="text-sm font-medium">Pending</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {emailLogs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No email history</p>
          </div>
        )}
      </div>
    </div>
  );
}
