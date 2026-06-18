import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Header } from '@stackbluff/shared/components/Header';
import { Toaster } from 'sonner';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="h-full flex flex-col">
      <Header />  {/* 👈 shared component */}
      <main className="flex-1 min-h-0 overflow-hidden pt-16">
        <Outlet />
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
