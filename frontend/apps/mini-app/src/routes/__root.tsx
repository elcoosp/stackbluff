import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Header } from '@stackbluff/shared/components/Header';

export const Route = createRootRoute({
  component: () => (
    <>
      <Header />
      <Outlet />
    </>
  ),
});
