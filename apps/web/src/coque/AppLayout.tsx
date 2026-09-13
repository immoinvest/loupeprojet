import type { JSX } from 'react';
import { Outlet } from 'react-router';

import { Sidebar } from './Sidebar';

export function AppLayout(): JSX.Element {
  return (
    <div className="grid min-h-screen grid-cols-[248px_minmax(0,1fr)] bg-fond">
      <Sidebar />
      <main className="min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
