import { createFileRoute } from '@tanstack/react-router';
import { TablePage } from '../../pages/TablePage';
import { useGameHandCompletion } from './useGameHandCompletion';

export const Route = createFileRoute('/table/$tableId')({
  component: TablePage,
});
