/**
 * Dashboard Home Page
 * Overview of all workshops with real-time statistics
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Workshop, Student, Attendance, WorkshopStats } from '@/lib/types';
import Link from 'next/link';
import { Users, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const [workshopStats, setWorkshopStats] = useState<WorkshopStats[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    loadDashboard();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadDashboard();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadDashboard = async () => {
    try {
      const supabase = createClient();

      const [{ data: workshops }, { data: students }, { data: attendance }] =
        await Promise.all([
          supabase.from('workshops').select('*').order('time_slot').order('workshop_name'),
          supabase.from('students').select('*'),
          supabase.from('attendance').select('*'),
        ]);

      if (!workshops || !students || !attendance) {
        toast.error('Failed to load data');
        setLoading(false);
        return;
      }

      // Calculate stats for each workshop
      const stats: WorkshopStats[] = workshops.map((workshop) => {
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

      setWorkshopStats(stats);
      setTotalStudents(students.length);
      setLastUpdate(new Date());
      setLoading(false);

    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load dashboard data');
      setLoading(false);
    }
  };

  // Break down stats by time slot
  const slot1Stats = workshopStats.filter(w => w.time_slot === 1);
  const slot2Stats = workshopStats.filter(w => w.time_slot === 2);

  const calculateSlotStats = (stats: WorkshopStats[]) => {
    const attended = stats.reduce((sum, s) => sum + s.attended, 0);
    const absent = stats.reduce((sum, s) => sum + s.absent, 0);
    const wrongWorkshop = stats.reduce((sum, s) => sum + s.wrong_workshop, 0);
    return { attended, absent, wrongWorkshop };
  };

  const slot1Data = calculateSlotStats(slot1Stats);
  const slot2Data = calculateSlotStats(slot2Stats);

  const totalStats = {
    registered: totalStudents,
    slot1: slot1Data,
    slot2: slot2Data,
  };

  const slot1AttendanceRate = (slot1Stats.reduce((sum, s) => sum + s.registered, 0) > 0)
    ? (slot1Data.attended / (slot1Data.attended + slot1Data.absent)) * 100
    : 0;

  const slot2AttendanceRate = (slot2Stats.reduce((sum, s) => sum + s.registered, 0) > 0)
    ? (slot2Data.attended / (slot2Data.attended + slot2Data.absent)) * 100
    : 0;

  const overallAttendanceRate =
    totalStudents > 0
      ? ((slot1Data.attended + slot2Data.attended) / totalStudents) * 100
      : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="animate-spin h-8 w-8 text-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Workshop Dashboard</h1>
        <div className="text-sm text-gray-500">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Registered"
          value={totalStats.registered}
          icon={<Users className="text-blue-600" />}
          color="bg-blue-50"
        />

        <div className="flex flex-col h-full">
          <h3 className="text-sm font-semibold text-gray-900 px-1 mb-3">Present</h3>
          <div className="grid grid-cols-2 gap-3 flex-1">
            <StatCard
              title="Slot 1"
              value={totalStats.slot1.attended}
              subtitle={`${slot1AttendanceRate.toFixed(1)}%`}
              icon={<CheckCircle className="text-green-600" size={18} />}
              color="bg-green-50"
              compact
            />
            <StatCard
              title="Slot 2"
              value={totalStats.slot2.attended}
              subtitle={`${slot2AttendanceRate.toFixed(1)}%`}
              icon={<CheckCircle className="text-green-600" size={18} />}
              color="bg-green-50"
              compact
            />
          </div>
        </div>

        <div className="flex flex-col h-full">
          <h3 className="text-sm font-semibold text-gray-900 px-1 mb-3">Absent</h3>
          <div className="grid grid-cols-2 gap-3 flex-1">
            <StatCard
              title="Slot 1"
              value={totalStats.slot1.absent}
              icon={<XCircle className="text-gray-600" size={18} />}
              color="bg-gray-50"
              compact
            />
            <StatCard
              title="Slot 2"
              value={totalStats.slot2.absent}
              icon={<XCircle className="text-gray-600" size={18} />}
              color="bg-gray-50"
              compact
            />
          </div>
        </div>

        <div className="flex flex-col h-full">
          <h3 className="text-sm font-semibold text-gray-900 px-1 mb-3">Wrong Workshop</h3>
          <div className="grid grid-cols-2 gap-3 flex-1">
            <StatCard
              title="Slot 1"
              value={totalStats.slot1.wrongWorkshop}
              icon={<AlertTriangle className="text-orange-600" size={18} />}
              color="bg-orange-50"
              compact
            />
            <StatCard
              title="Slot 2"
              value={totalStats.slot2.wrongWorkshop}
              icon={<AlertTriangle className="text-orange-600" size={18} />}
              color="bg-orange-50"
              compact
            />
          </div>
        </div>
      </div>

      {/* Workshop List */}
      <div className="space-y-6">
        {[1, 2].map((slot) => {
          const slotWorkshops = workshopStats.filter(
            (w) => w.time_slot === slot
          );

          if (slotWorkshops.length === 0) return null;

          return (
            <div key={slot}>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Time Slot {slot}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {slotWorkshops.map((workshop) => (
                  <WorkshopCard key={workshop.id} workshop={workshop} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {workshopStats.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No workshops found
          </h3>
          <p className="text-gray-500">
            Import data from Google Sheets to get started.
          </p>
          <Link
            href="/import"
            className="inline-block mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Import Data
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  compact = false,
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="bg-white rounded-lg shadow p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-600">{title}</span>
          <div className={`p-1 rounded ${color}`}>{icon}</div>
        </div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        {subtitle && <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{title}</span>
        <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}

function WorkshopCard({ workshop }: { workshop: WorkshopStats }) {
  return (
    <Link
      href={`/workshops/${workshop.id}`}
      className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 mb-1">
            {workshop.workshop_name}
          </h3>
          {workshop.room_location && (
            <p className="text-sm text-gray-500">{workshop.room_location}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">
            {workshop.attendance_rate.toFixed(0)}%
          </div>
          <div className="text-xs text-gray-500">attendance</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-lg font-semibold text-gray-900">
            {workshop.registered}
          </div>
          <div className="text-xs text-gray-500">Registered</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-green-600">
            {workshop.attended}
          </div>
          <div className="text-xs text-gray-500">Present</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-600">
            {workshop.absent}
          </div>
          <div className="text-xs text-gray-500">Absent</div>
        </div>
      </div>

      {workshop.wrong_workshop > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center text-orange-600 text-sm">
            <AlertTriangle size={16} className="mr-2" />
            {workshop.wrong_workshop} in wrong workshop
          </div>
        </div>
      )}
    </Link>
  );
}
