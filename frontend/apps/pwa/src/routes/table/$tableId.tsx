import { getToken } from '@stackbluff/shared/auth/token';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { generateAndSubmitFingerprint } from '@/services/fingerprint';
import { TablePage } from '../../pages/TablePage';

export interface TableSearchParams {
  observe?: string;
  tournamentId?: string;
  buyIn?: string;
}

export const Route = createFileRoute('/table/$tableId')({
  component: TablePageWithFingerprint,
  validateSearch: (search: Record<string, string>): TableSearchParams => ({
    observe: search.observe,
    tournamentId: search.tournamentId,
    buyIn: search.buyIn,
  }),
});

function TablePageWithFingerprint() {
  useEffect(() => {
    const token = getToken();
    if (token) {
      generateAndSubmitFingerprint(token).catch((err) => {
        console.warn('Fingerprint submission on table mount failed:', err);
      });
    }
  }, []);

  return <TablePage />;
}
