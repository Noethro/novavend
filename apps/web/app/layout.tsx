import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { DashboardShell } from '../src/components/dashboard-shell';
import { LocaleProvider } from '../src/i18n/locale-provider';
import './styles.css';

export const metadata: Metadata = {
  title: 'NovaVend',
  description: 'Clean-room Second Life commerce infrastructure.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <LocaleProvider>
          <DashboardShell>{children}</DashboardShell>
        </LocaleProvider>
      </body>
    </html>
  );
}
