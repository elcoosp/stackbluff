import { createFileRoute } from '@tanstack/react-router';
import { ClubPage } from '../pages/ClubPage';
import { requireAuth } from '@/lib/authGuard';

export const Route = createFileRoute("/clubs/$clubId")({
  beforeLoad: () => requireAuth(),
  component: ClubPage,
});
