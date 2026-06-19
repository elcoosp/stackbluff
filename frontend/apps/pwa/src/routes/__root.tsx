import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Header } from '@stackbluff/shared/components/Header';
import { Toaster } from 'sonner';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="h-full">
      <Header />  {/* fixed header, out of flow */}
      <main className="mt-16 h-[calc(100vh-64px)] overflow-y-auto">
        <Outlet />
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
