/**
 * Student Management Page
 * Full CRUD operations for managing students
 */

'use client';

import { useEffect, useState } from 'react';
import { createServiceClient } from '@/lib/supabase';
import { Student, Workshop } from '@/lib/types';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  X,
  Save,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Student | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [students, searchQuery]);

  const loadData = async () => {
    try {
      const supabase = createServiceClient();

      const [{ data: studentsData }, { data: workshopsData }] = await Promise.all([
        supabase.from('students').select('*').order('student_name'),
        supabase.from('workshops').select('*').order('workshop_name'),
      ]);

      if (studentsData) setStudents(studentsData);
      if (workshopsData) setWorkshops(workshopsData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load students');
      setLoading(false);
    }
  };

  const filterStudents = () => {
    if (!searchQuery) {
      setFilteredStudents(students);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = students.filter(
      (s) =>
        s.student_name?.toLowerCase().includes(query) ||
        s.registration_id?.toLowerCase().includes(query) ||
        s.supervisor_email?.toLowerCase().includes(query) ||
        s.supervisor_name?.toLowerCase().includes(query)
    );
    setFilteredStudents(filtered);
  };

  const handleDelete = async (student: Student) => {
    try {
      const supabase = createServiceClient();

      // Check if student has attendance records
      const { data: attendance } = await supabase
        .from('attendance')
        .select('id')
        .eq('student_id', student.id)
        .limit(1);

      if (attendance && attendance.length > 0) {
        const confirmed = confirm(
          `${student.student_name} has attendance records. Delete student and all attendance records?`
        );
        if (!confirmed) return;

        // Delete attendance first
        await supabase.from('attendance').delete().eq('student_id', student.id);
      }

      // Delete student
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', student.id);

      if (error) throw error;

      toast.success('Student deleted successfully');
      setDeleteConfirm(null);
      loadData();
    } catch (error) {
      console.error('Error deleting student:', error);
      toast.error('Failed to delete student');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="animate-spin h-8 w-8 text-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading students...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Student Management
          </h1>
          <p className="text-gray-600">
            Add, edit, and manage student registrations
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          <Plus size={20} />
          <span>Add Student</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Search by name, registration ID, supervisor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 text-primary hover:text-primary-dark transition-colors"
            title="Refresh"
          >
            <RefreshCw size={20} />
          </button>
        </div>
        <div className="mt-2 text-sm text-gray-600">
          Showing {filteredStudents.length} of {students.length} students
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registration ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supervisor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Workshop Slot 1
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Workshop Slot 2
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStudents.map((student) => {
                const workshop1 = workshops.find(
                  (w) => w.id === student.workshop_slot1_id
                );
                const workshop2 = workshops.find(
                  (w) => w.id === student.workshop_slot2_id
                );

                return (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {student.registration_id}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {student.student_name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {student.supervisor_name || '—'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {student.supervisor_email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {workshop1?.workshop_name || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {workshop2?.workshop_name || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setEditingStudent(student)}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(student)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredStudents.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchQuery ? 'No students match your search' : 'No students found'}
            </p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingStudent) && (
        <StudentFormModal
          student={editingStudent}
          workshops={workshops}
          onClose={() => {
            setShowAddModal(false);
            setEditingStudent(null);
          }}
          onSave={() => {
            setShowAddModal(false);
            setEditingStudent(null);
            loadData();
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-start space-x-3 mb-4">
              <AlertCircle className="text-red-600 flex-shrink-0" size={24} />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete Student?
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Are you sure you want to delete {deleteConfirm.student_name}? This
                  action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentFormModal({
  student,
  workshops,
  onClose,
  onSave,
}: {
  student: Student | null;
  workshops: Workshop[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    registration_id: student?.registration_id || '',
    student_name: student?.student_name || '',
    supervisor_name: student?.supervisor_name || '',
    supervisor_email: student?.supervisor_email || '',
    workshop_slot1_id: student?.workshop_slot1_id || '',
    workshop_slot2_id: student?.workshop_slot2_id || '',
    notes: student?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const supabase = createServiceClient();

      if (student) {
        // Update existing student
        const { error } = await supabase
          .from('students')
          .update({
            registration_id: formData.registration_id,
            student_name: formData.student_name,
            supervisor_name: formData.supervisor_name || null,
            supervisor_email: formData.supervisor_email,
            workshop_slot1_id: formData.workshop_slot1_id || null,
            workshop_slot2_id: formData.workshop_slot2_id || null,
            notes: formData.notes || null,
          })
          .eq('id', student.id);

        if (error) throw error;
        toast.success('Student updated successfully');
      } else {
        // Create new student
        const { error } = await supabase.from('students').insert({
          registration_id: formData.registration_id,
          student_name: formData.student_name,
          supervisor_name: formData.supervisor_name || null,
          supervisor_email: formData.supervisor_email,
          workshop_slot1_id: formData.workshop_slot1_id || null,
          workshop_slot2_id: formData.workshop_slot2_id || null,
          notes: formData.notes || null,
        });

        if (error) throw error;
        toast.success('Student added successfully');
      }

      onSave();
    } catch (error: any) {
      console.error('Error saving student:', error);
      if (error.code === '23505') {
        toast.error('Registration ID already exists');
      } else {
        toast.error('Failed to save student');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {student ? 'Edit Student' : 'Add New Student'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Registration ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Registration ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.registration_id}
              onChange={(e) =>
                setFormData({ ...formData, registration_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., ST001"
            />
          </div>

          {/* Student Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Student Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.student_name}
              onChange={(e) =>
                setFormData({ ...formData, student_name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., Alice Anderson"
            />
          </div>

          {/* Supervisor Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supervisor Name
            </label>
            <input
              type="text"
              value={formData.supervisor_name}
              onChange={(e) =>
                setFormData({ ...formData, supervisor_name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., Ms. Johnson"
            />
          </div>

          {/* Supervisor Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supervisor Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={formData.supervisor_email}
              onChange={(e) =>
                setFormData({ ...formData, supervisor_email: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., mjohnson@school.com"
            />
          </div>

          {/* Workshop Slot 1 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workshop Slot 1
            </label>
            <select
              value={formData.workshop_slot1_id}
              onChange={(e) =>
                setFormData({ ...formData, workshop_slot1_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">-- None --</option>
              {workshops
                .filter((w) => w.time_slot === 1)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.workshop_name} ({w.room_location || 'TBD'})
                  </option>
                ))}
            </select>
          </div>

          {/* Workshop Slot 2 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workshop Slot 2
            </label>
            <select
              value={formData.workshop_slot2_id}
              onChange={(e) =>
                setFormData({ ...formData, workshop_slot2_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">-- None --</option>
              {workshops
                .filter((w) => w.time_slot === 2)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.workshop_name} ({w.room_location || 'TBD'})
                  </option>
                ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Any additional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>{student ? 'Update' : 'Add'} Student</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
