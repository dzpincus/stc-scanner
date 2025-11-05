/**
 * Root Layout
 * Main layout with navigation and global styles
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { Home, Users, Mail, Upload, UserCircle } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stage the Change - Admin Dashboard',
  description: 'Workshop attendance management system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
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
      </body>
    </html>
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
