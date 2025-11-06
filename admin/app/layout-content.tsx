'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Mail, Upload, UserCircle } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

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
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-primary text-white shadow-lg">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold">Stage the Change</h1>
                <span className="text-sm opacity-90">Admin Dashboard</span>
              </div>
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
    </>
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
