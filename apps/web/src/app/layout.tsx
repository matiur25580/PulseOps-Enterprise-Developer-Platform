import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PulseOps — Developer Operations Platform',
  description: 'A unified workspace for service ownership, reliability, incidents, and cloud operations.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
