'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Home, Users, Mail, Upload, UserCircle, Lock, Unlock, FlaskConical } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { ActiveEventProvider, useActiveEvent } from '@/lib/event-context';

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Check if we're on a public route (login, privacy, terms)
  const isPublicRoute =
    pathname === '/login' ||
    pathname === '/privacy' ||
    pathname === '/terms' ||
    pathname?.startsWith('/auth/callback');

  if (isPublicRoute) {
    // Unauthenticated layout - just content, no header/nav
    return (
      <>
        <div className="min-h-screen">{children}</div>
        <Toaster position="top-right" />
      </>
    );
  }

  // Authenticated layout with header and nav
  return (
    <ActiveEventProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-primary text-white shadow-lg">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold">Stage the Change</h1>
                <span className="text-sm opacity-90">Admin Dashboard</span>
              </div>
              <EventBadge />
            </div>
          </div>
        </header>
        <TestDataBanner />

        {/* Navigation */}
        <nav className="bg-white border-b border-gray-200">
          <div className="container mx-auto px-4">
            <div className="flex space-x-8">
              <NavLink href="/" icon={<Home size={18} />}>
                Dashboard
              </NavLink>
              <NavLink href="/workshops" icon={<Users size={18} />}>
                Workshops
              </NavLink>
              <NavLink href="/students" icon={<UserCircle size={18} />}>
                Students
              </NavLink>
              <NavLink href="/emails" icon={<Mail size={18} />}>
                Emails
              </NavLink>
              <NavLink href="/import" icon={<Upload size={18} />}>
                Import Data
              </NavLink>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">{children}</main>
      </div>

      <Toaster position="top-right" />
    </ActiveEventProvider>
  );
}

/**
 * Active event picker plus the event-mode lock. Locked = doors are open: imports and
 * deletes are refused everywhere, and the active event cannot be switched, until an
 * admin deliberately unlocks.
 */
function EventBadge() {
  const { event, events, loading, setLocked, switchEvent } = useActiveEvent();
  const [switching, setSwitching] = useState(false);
  if (loading) return null;
  if (!event) {
    return <span className="text-sm bg-red-600 px-3 py-1 rounded">No active event configured</span>;
  }

  const switchTo = async (slug: string) => {
    const target = events.find((e) => e.slug === slug);
    if (!target || target.id === event.id) return;
    const ok = window.confirm(
      `Switch the active event to "${target.name}"?\n\n` +
        `The dashboard and every phone will show that event's students, workshops and attendance after their next sync. ` +
        `Nothing is deleted; you can switch back at any time.` +
        (target.is_test ? '\n\nThis is a TEST dataset. Emails will be marked [TEST] and only go to @stagethechange.org addresses.' : '')
    );
    if (!ok) return;
    setSwitching(true);
    const err = await switchEvent(slug);
    setSwitching(false);
    if (err) toast.error(`Could not switch event: ${err}`);
    else toast.success(`Active event: ${target.name}`);
  };

  const toggle = async () => {
    const next = !event.locked;
    const msg = next
      ? `Lock "${event.name}" for event day?\n\nCSV imports and student/workshop deletes will be disabled until unlocked.`
      : `Unlock "${event.name}"?\n\nImports and deletes become possible again. Only do this if the event is not in progress.`;
    if (!window.confirm(msg)) return;
    const ok = await setLocked(next);
    if (ok) toast.success(next ? 'Event locked' : 'Event unlocked');
    else toast.error('Could not update event lock');
  };

  return (
    <div className="flex items-center space-x-3 text-sm">
      <select
        aria-label="Active event"
        value={event.slug}
        disabled={event.locked || switching}
        onChange={(e) => switchTo(e.target.value)}
        title={event.locked ? 'Unlock the event before switching datasets' : 'Switch the active event (dashboard and phones follow)'}
        className="bg-white/20 text-white rounded px-2 py-1 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/60 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {events.map((e) => (
          <option key={e.id} value={e.slug} className="text-gray-900">
            {e.name}
            {e.is_test ? ' (test)' : ''}
          </option>
        ))}
      </select>
      <button
        onClick={toggle}
        title={event.locked ? 'Event mode on: imports and deletes disabled' : 'Event mode off: click to lock before doors open'}
        className={`flex items-center space-x-1 px-3 py-1 rounded font-medium transition-colors ${
          event.locked ? 'bg-red-600 hover:bg-red-700' : 'bg-white/20 hover:bg-white/30'
        }`}
      >
        {event.locked ? <Lock size={14} /> : <Unlock size={14} />}
        <span>{event.locked ? 'Locked (event mode)' : 'Unlocked'}</span>
      </button>
    </div>
  );
}

/** Loud reminder while a test dataset is live, so nobody mistakes it for the real roster. */
function TestDataBanner() {
  const { event } = useActiveEvent();
  if (!event?.is_test) return null;
  return (
    <div className="bg-amber-400 text-amber-950 text-sm font-medium">
      <div className="container mx-auto px-4 py-2 flex items-center gap-2">
        <FlaskConical size={16} />
        <span>
          TEST DATA: &ldquo;{event.name}&rdquo; is the active event. The dashboard and all phones show test data.
          Emails are marked [TEST] and only go to @stagethechange.org addresses. Switch back with the event menu above.
        </span>
      </div>
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center space-x-2 py-4 border-b-2 border-transparent hover:border-primary transition-colors"
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
