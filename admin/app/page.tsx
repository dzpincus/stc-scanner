/**
 * Dashboard Home Page
 * Overview of all workshops with real-time statistics
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Device, WorkshopStats } from '@/lib/types';
import Link from 'next/link';
import { Users, CheckCircle, XCircle, AlertTriangle, RefreshCw, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { useActiveEvent } from '@/lib/event-context';
import { computeWorkshopStats, summarizeSlot } from '@/lib/stats';

export default function DashboardPage() {
  const { event, loading: eventLoading } = useActiveEvent();
  const [workshopStats, setWorkshopStats] = useState<WorkshopStats[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const eventId = event?.id;

  useEffect(() => {
    if (eventLoading) return;
    loadDashboard();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadDashboard();
    }, 30000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, eventLoading]);

  const loadDashboard = async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    try {
      const supabase = createClient();

      const [{ data: workshops }, { data: students }, { data: attendance }, { data: deviceRows }] =
        await Promise.all([
          supabase.from('workshops').select('*').eq('event_id', eventId).order('time_slot').order('workshop_name'),
          supabase.from('students').select('*').eq('event_id', eventId),
          supabase.from('attendance').select('*').eq('event_id', eventId),
          supabase.from('devices').select('*').eq('event_id', eventId).order('last_seen_at', { ascending: false }),
        ]);

      setDevices((deviceRows || []) as Device[]);

      if (!workshops || !students || !attendance) {
        toast.error('Failed to load data');
        setLoading(false);
        return;
      }

      setWorkshopStats(computeWorkshopStats(workshops, students, attendance));
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

  const slot1Data = summarizeSlot(slot1Stats);
  const slot2Data = summarizeSlot(slot2Stats);

  const totalStats = {
    registered: totalStudents,
    slot1: slot1Data,
    slot2: slot2Data,
  };

  const slot1AttendanceRate = slot1Data.rate;
  const slot2AttendanceRate = slot2Data.rate;

  if (loading || eventLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="animate-spin h-8 w-8 text-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-800">
        No active event. Set <code>is_active = true</code> on exactly one row of <code>events</code>.
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

      {/* Scanner phones */}
      <DevicesPanel devices={devices} workshops={workshopStats} />

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

const STALE_MS = 3 * 60 * 1000;

/**
 * Every phone upserts a heartbeat on each sync. Red rows are the ones to chase before
 * the end of a slot: unsynced scans, a sync error, or no contact for a few minutes.
 */
function DevicesPanel({ devices, workshops }: { devices: Device[]; workshops: WorkshopStats[] }) {
  if (devices.length === 0) return null;
  const nameOf = (id: string | null) => workshops.find((w) => w.id === id)?.workshop_name || '—';
  const now = Date.now();
  const problems = devices.filter(
    (d) => d.unsynced_count > 0 || d.last_error || (d.last_seen_at && now - new Date(d.last_seen_at).getTime() > STALE_MS)
  ).length;

  return (
    <div className="bg-white rounded-lg shadow mb-8">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Smartphone size={18} className="text-primary" />
          <h2 className="font-semibold text-gray-900">Scanner phones ({devices.length})</h2>
        </div>
        <span className={`text-sm font-medium ${problems ? 'text-red-600' : 'text-green-600'}`}>
          {problems ? `${problems} need attention` : 'All phones synced'}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 uppercase">
              <th className="px-6 py-2">Phone</th>
              <th className="px-6 py-2">Workshop</th>
              <th className="px-6 py-2">Last seen</th>
              <th className="px-6 py-2">Unsynced</th>
              <th className="px-6 py-2">Last error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {devices.map((d) => {
              const seenAgo = d.last_seen_at ? now - new Date(d.last_seen_at).getTime() : Infinity;
              const stale = seenAgo > STALE_MS;
              const bad = d.unsynced_count > 0 || !!d.last_error || stale;
              return (
                <tr key={d.device_id} className={bad ? 'bg-red-50' : ''}>
                  <td className="px-6 py-2">
                    <div className="font-medium text-gray-900">{d.label || d.device_id.slice(0, 8)}</div>
                    <div className="text-xs text-gray-500">
                      {d.platform} · v{d.app_version || '?'} · {d.device_id.slice(0, 8)}
                    </div>
                  </td>
                  <td className="px-6 py-2 text-gray-700">{nameOf(d.selected_workshop_id)}</td>
                  <td className={`px-6 py-2 ${stale ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                    {d.last_seen_at ? formatDistanceToNow(new Date(d.last_seen_at), { addSuffix: true }) : 'never'}
                  </td>
                  <td className={`px-6 py-2 font-semibold ${d.unsynced_count > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                    {d.unsynced_count}
                  </td>
                  <td className="px-6 py-2 text-xs text-red-700 max-w-xs truncate" title={d.last_error || ''}>
                    {d.last_error || ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
