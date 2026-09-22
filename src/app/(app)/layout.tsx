import type { ReactNode } from 'react';
import { AppShell } from '@ui/components/AppShell';

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
