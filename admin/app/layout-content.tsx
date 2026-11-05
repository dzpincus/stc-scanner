'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Mail, Upload, UserCircle, Lock, Unlock } from 'lucide-react';
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
 * Active event name plus the event-mode lock. Locked = doors are open: imports and
 * deletes are refused everywhere until an admin deliberately unlocks.
 */
function EventBadge() {
  const { event, loading, setLocked } = useActiveEvent();
  if (loading) return null;
  if (!event) {
    return <span className="text-sm bg-red-600 px-3 py-1 rounded">No active event configured</span>;
  }

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
      <span className="opacity-90">{event.name}</span>
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
