/**
 * Workshops List Page
 * Table view of all workshops with search, filter, and statistics
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { WorkshopStats } from '@/lib/types';
import Link from 'next/link';
import { Users, Search, Filter, ArrowUpDown, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

type SortField = 'workshop_name' | 'time_slot' | 'registered' | 'attended' | 'attendance_rate';
type SortDirection = 'asc' | 'desc';

export default function WorkshopsPage() {
  const [workshops, setWorkshops] = useState<WorkshopStats[]>([]);
  const [filteredWorkshops, setFilteredWorkshops] = useState<WorkshopStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeSlotFilter, setTimeSlotFilter] = useState<'all' | 1 | 2>('all');
  const [sortField, setSortField] = useState<SortField>('workshop_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    loadWorkshops();
  }, []);

  useEffect(() => {
    filterAndSortWorkshops();
  }, [workshops, searchQuery, timeSlotFilter, sortField, sortDirection]);

  const loadWorkshops = async () => {
    try {
      const supabase = createClient();

      const [{ data: workshopsData }, { data: students }, { data: attendance }] =
        await Promise.all([
          supabase.from('workshops').select('*').order('time_slot').order('workshop_name'),
          supabase.from('students').select('*'),
          supabase.from('attendance').select('*'),
        ]);

      if (!workshopsData || !students || !attendance) {
        toast.error('Failed to load workshops');
        setLoading(false);
        return;
      }

      // Calculate stats for each workshop
      const stats: WorkshopStats[] = workshopsData.map((workshop) => {
        const registered = students.filter(
          (s) =>
            s.workshop_slot1_id === workshop.id ||
            s.workshop_slot2_id === workshop.id
        ).length;

        const workshopAttendance = attendance.filter(
          (a) => a.workshop_id === workshop.id
        );

        const attended = workshopAttendance.length;
        const wrongWorkshop = workshopAttendance.filter(
          (a) => !a.is_correct_workshop
        ).length;
        const absent = registered - attended;
        const attendance_rate = registered > 0 ? (attended / registered) * 100 : 0;

        return {
          id: workshop.id,
          workshop_name: workshop.workshop_name,
          time_slot: workshop.time_slot,
          room_location: workshop.room_location,
          registered,
          attended,
          absent,
          wrong_workshop: wrongWorkshop,
          attendance_rate,
        };
      });

      setWorkshops(stats);
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">All Workshops</h1>
        <p className="text-gray-600">
          View and manage all workshops with attendance statistics
        </p>
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
                    <Link
                      href={`/workshops/${workshop.id}`}
                      className="text-primary hover:text-primary-dark transition-colors"
                    >
                      View Details →
                    </Link>
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
