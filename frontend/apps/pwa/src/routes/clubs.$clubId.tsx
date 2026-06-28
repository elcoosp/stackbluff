import { createFileRoute } from '@tanstack/react-router';
import { ClubPage } from '../pages/ClubPage';

export const Route = createFileRoute('/clubs/$clubId')({
  component: ClubPage,
});
