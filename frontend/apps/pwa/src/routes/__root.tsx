import { Outlet, createRootRoute } from '@tanstack/react-router';
import { Header } from '@stackbluff/shared/components/Header';

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <Outlet />
      </main>
    </div>
  ),
});
