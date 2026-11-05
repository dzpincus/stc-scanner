/**
 * Workshops List Page
 * Table view of all workshops with search, filter, and statistics
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { WorkshopStats, Workshop } from '@/lib/types';
import Link from 'next/link';
import { Users, Search, Filter, ArrowUpDown, RefreshCw, Plus, Edit2, Trash2, X, Save, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useActiveEvent } from '@/lib/event-context';
import { computeWorkshopStats } from '@/lib/stats';

type SortField = 'workshop_name' | 'time_slot' | 'registered' | 'attended' | 'attendance_rate';
type SortDirection = 'asc' | 'desc';

export default function WorkshopsPage() {
  const { event, loading: eventLoading } = useActiveEvent();
  const eventId = event?.id;
  const [workshops, setWorkshops] = useState<WorkshopStats[]>([]);
  const [filteredWorkshops, setFilteredWorkshops] = useState<WorkshopStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeSlotFilter, setTimeSlotFilter] = useState<'all' | 1 | 2>('all');
  const [sortField, setSortField] = useState<SortField>('workshop_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<WorkshopStats | null>(null);

  useEffect(() => {
    if (eventLoading) return;
    loadWorkshops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, eventLoading]);

  useEffect(() => {
    filterAndSortWorkshops();
  }, [workshops, searchQuery, timeSlotFilter, sortField, sortDirection]);

  const loadWorkshops = async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    try {
      const supabase = createClient();

      const [{ data: workshopsData }, { data: students }, { data: attendance }] =
        await Promise.all([
          supabase.from('workshops').select('*').eq('event_id', eventId).order('time_slot').order('workshop_name'),
          supabase.from('students').select('*').eq('event_id', eventId),
          supabase.from('attendance').select('*').eq('event_id', eventId),
        ]);

      if (!workshopsData || !students || !attendance) {
        toast.error('Failed to load workshops');
        setLoading(false);
        return;
      }

      setWorkshops(computeWorkshopStats(workshopsData, students, attendance));
      setLoading(false);
    } catch (error) {
      console.error('Error loading workshops:', error);
      toast.error('Failed to load workshops');
      setLoading(false);
    }
  };

  const filterAndSortWorkshops = () => {
    let filtered = [...workshops];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((w) =>
        w.workshop_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.room_location?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply time slot filter
    if (timeSlotFilter !== 'all') {
      filtered = filtered.filter((w) => w.time_slot === timeSlotFilter);
    }

    // Apply sort
    filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle null values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      // Compare
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        return sortDirection === 'asc'
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number);
      }
    });

    setFilteredWorkshops(filtered);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDelete = async (workshop: WorkshopStats) => {
    try {
      const supabase = createClient();

      // Check if workshop has students assigned
      if (workshop.registered > 0) {
        toast.error(
          `Cannot delete workshop with ${workshop.registered} student(s) assigned. Please reassign students first.`
        );
        setDeleteConfirm(null);
        return;
      }

      // Delete workshop (DB refuses via ON DELETE RESTRICT if any student or attendance references it)
      const { error } = await supabase
        .from('workshops')
        .delete()
        .eq('id', workshop.id);

      if (error) throw error;

      toast.success('Workshop deleted successfully');
      setDeleteConfirm(null);
      loadWorkshops();
    } catch (error: any) {
      console.error('Error deleting workshop:', error);
      if (error?.code === '23503') {
        toast.error('Workshop still has students or attendance attached; it cannot be deleted.');
      } else {
        toast.error('Failed to delete workshop');
      }
      setDeleteConfirm(null);
    }
  };

  const totalStats = workshops.reduce(
    (acc, stat) => ({
      registered: acc.registered + stat.registered,
      attended: acc.attended + stat.attended,
      absent: acc.absent + stat.absent,
      wrong_workshop: acc.wrong_workshop + stat.wrong_workshop,
    }),
    { registered: 0, attended: 0, absent: 0, wrong_workshop: 0 }
  );

  const overallAttendanceRate =
    totalStats.registered > 0
      ? (totalStats.attended / totalStats.registered) * 100
      : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="animate-spin h-8 w-8 text-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading workshops...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">All Workshops</h1>
          <p className="text-gray-600">
            View and manage all workshops with attendance statistics
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          <Plus size={20} />
          <span>Add Workshop</span>
        </button>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Workshops"
          value={workshops.length}
          color="bg-blue-50"
          textColor="text-blue-600"
        />
        <StatCard
          title="Total Registered"
          value={totalStats.registered}
          color="bg-green-50"
          textColor="text-green-600"
        />
        <StatCard
          title="Total Attended"
          value={totalStats.attended}
          subtitle={`${overallAttendanceRate.toFixed(1)}%`}
          color="bg-purple-50"
          textColor="text-purple-600"
        />
        <StatCard
          title="Wrong Workshop"
          value={totalStats.wrong_workshop}
          color="bg-orange-50"
          textColor="text-orange-600"
        />
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Search workshops by name or room..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Time Slot Filter */}
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-gray-400" />
            <select
              value={timeSlotFilter}
              onChange={(e) =>
                setTimeSlotFilter(
                  e.target.value === 'all'
                    ? 'all'
                    : parseInt(e.target.value) as 1 | 2
                )
              }
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">All Time Slots</option>
              <option value="1">Time Slot 1</option>
              <option value="2">Time Slot 2</option>
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={loadWorkshops}
            className="px-4 py-2 text-primary hover:text-primary-dark transition-colors"
            title="Refresh data"
          >
            <RefreshCw size={20} />
          </button>
        </div>

        {searchQuery || timeSlotFilter !== 'all' ? (
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredWorkshops.length} of {workshops.length} workshops
          </div>
        ) : null}
      </div>

      {/* Workshops Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <SortableHeader
                  field="workshop_name"
                  label="Workshop Name"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <SortableHeader
                  field="time_slot"
                  label="Time Slot"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Room
                </th>
                <SortableHeader
                  field="registered"
                  label="Registered"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <SortableHeader
                  field="attended"
                  label="Attended"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Absent
                </th>
                <SortableHeader
                  field="attendance_rate"
                  label="Rate"
                  sortField={sortField}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredWorkshops.map((workshop) => (
                <tr key={workshop.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {workshop.workshop_name}
                    </div>
                    {workshop.wrong_workshop > 0 && (
                      <div className="text-xs text-orange-600 mt-1">
                        {workshop.wrong_workshop} wrong workshop
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Slot {workshop.time_slot}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {workshop.room_location || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {workshop.registered}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                    {workshop.attended}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {workshop.absent}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900">
                        {workshop.attendance_rate.toFixed(1)}%
                      </div>
                      <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2"
                          style={{ width: `${workshop.attendance_rate}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-3">
                      <Link
                        href={`/workshops/${workshop.id}`}
                        className="text-primary hover:text-primary-dark transition-colors"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => setEditingWorkshop(workshop as any)}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      {!event?.locked && (
                        <button
                          onClick={() => setDeleteConfirm(workshop)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredWorkshops.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchQuery || timeSlotFilter !== 'all'
                ? 'No workshops match your filters'
                : 'No workshops found'}
            </p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingWorkshop) && (
        <WorkshopFormModal
          workshop={editingWorkshop}
          onClose={() => {
            setShowAddModal(false);
            setEditingWorkshop(null);
          }}
          onSave={() => {
            setShowAddModal(false);
            setEditingWorkshop(null);
            loadWorkshops();
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
                  Delete Workshop?
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Are you sure you want to delete "{deleteConfirm.workshop_name}"? This
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

function StatCard({
  title,
  value,
  subtitle,
  color,
  textColor,
}: {
  title: string;
  value: number;
  subtitle?: string;
  color: string;
  textColor: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="text-sm font-medium text-gray-600 mb-2">{title}</div>
      <div className={`text-3xl font-bold ${textColor}`}>{value}</div>
      {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}

function SortableHeader({
  field,
  label,
  sortField,
  sortDirection,
  onSort,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const isActive = sortField === field;

  return (
    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      <button
        onClick={() => onSort(field)}
        className="flex items-center space-x-1 hover:text-gray-700 transition-colors"
      >
        <span>{label}</span>
        <ArrowUpDown
          size={14}
          className={isActive ? 'text-primary' : 'text-gray-400'}
        />
        {isActive && (
          <span className="text-primary text-xs">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </button>
    </th>
  );
}

function WorkshopFormModal({
  workshop,
  onClose,
  onSave,
}: {
  workshop: Workshop | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    workshop_name: workshop?.workshop_name || '',
    time_slot: workshop?.time_slot || 1,
    room_location: workshop?.room_location || '',
    description: workshop?.description || '',
    capacity: workshop?.capacity || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const supabase = createClient();

      const workshopData = {
        workshop_name: formData.workshop_name,
        time_slot: formData.time_slot,
        room_location: formData.room_location || null,
        description: formData.description || null,
        capacity: formData.capacity ? parseInt(formData.capacity.toString()) : null,
      };

      if (workshop) {
        // Update existing workshop
        const { error } = await supabase
          .from('workshops')
          .update(workshopData)
          .eq('id', workshop.id);

        if (error) throw error;
        toast.success('Workshop updated successfully');
      } else {
        // Create new workshop in the active event
        const { data: activeEvent } = await supabase.from('events').select('id').eq('is_active', true).maybeSingle();
        if (!activeEvent) throw new Error('No active event');
        const { error } = await supabase.from('workshops').insert({ ...workshopData, event_id: activeEvent.id });

        if (error) throw error;
        toast.success('Workshop added successfully');
      }

      onSave();
    } catch (error: any) {
      console.error('Error saving workshop:', error);
      if (error.code === '23505') {
        toast.error('A workshop with this name and time slot already exists');
      } else {
        toast.error('Failed to save workshop');
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
            {workshop ? 'Edit Workshop' : 'Add New Workshop'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Workshop Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workshop Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.workshop_name}
              onChange={(e) =>
                setFormData({ ...formData, workshop_name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., Introduction to Theatre"
            />
          </div>

          {/* Time Slot */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Time Slot <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.time_slot}
              onChange={(e) =>
                setFormData({ ...formData, time_slot: parseInt(e.target.value) as 1 | 2 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value={1}>Slot 1</option>
              <option value={2}>Slot 2</option>
            </select>
          </div>

          {/* Room Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Room Location
            </label>
            <input
              type="text"
              value={formData.room_location}
              onChange={(e) =>
                setFormData({ ...formData, room_location: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., Room 201, Main Auditorium"
            />
          </div>

          {/* Capacity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Capacity
            </label>
            <input
              type="number"
              min="1"
              value={formData.capacity}
              onChange={(e) =>
                setFormData({ ...formData, capacity: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., 30"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Brief description of the workshop..."
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
                  <span>{workshop ? 'Update' : 'Add'} Workshop</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
