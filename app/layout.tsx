import type { Metadata } from 'next';
import { Bebas_Neue, Manrope } from 'next/font/google';
import './globals.css';

const teamBackdropFont = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-team-backdrop',
});

const dashboardFont = Manrope({
  subsets: ['latin'],
  variable: '--font-dashboard',
});

const backdropRows = Array.from({ length: 36 }, (_, index) => `Team 02-${index}`);

export const metadata: Metadata = {
  title: 'Todo App',
  description: 'Todo app with CRUD operations',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${teamBackdropFont.variable} ${dashboardFont.variable}`}>
      <body>
        <div className="team-backdrop" aria-hidden="true">
          {backdropRows.map((key) => (
            <span key={key} className="team-backdrop__text">
              Team 02
            </span>
          ))}
        </div>
        <div className="app-content">{children}</div>
      </body>
    </html>
  );
}