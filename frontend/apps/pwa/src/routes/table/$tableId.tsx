import { createFileRoute } from '@tanstack/react-router';
import { TablePage } from '../../pages/TablePage';
import { useEffect } from 'react';
import { generateAndSubmitFingerprint } from '@/services/fingerprint';
import { getToken } from '@stackbluff/shared/auth/token';

export const Route = createFileRoute('/table/$tableId')({
  component: TablePageWithFingerprint,
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
