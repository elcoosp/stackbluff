import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/lib/authGuard';
import { ClubPage } from '../pages/ClubPage';

export const Route = createFileRoute('/clubs/$clubId')({
  beforeLoad: () => requireAuth(),
  component: ClubPage,
});
