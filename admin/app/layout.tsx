/**
 * Root Layout
 * Main layout with navigation and global styles
 */

import type { Metadata } from 'next';
import { LayoutContent } from './layout-content';
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
        <LayoutContent>{children}</LayoutContent>
      </body>
    </html>
  );
}
