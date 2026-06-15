import { Outlet, createRootRoute } from '@tanstack/react-router';
import { Header } from '@stackbluff/shared/components/Header';
import { Toaster } from 'sonner';

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <Outlet />
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  ),
});
