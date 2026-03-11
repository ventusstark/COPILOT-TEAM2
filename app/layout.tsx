import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Todo App',
  description: 'Todo app with CRUD operations',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}