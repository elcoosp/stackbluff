import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateTableModal } from '../components/CreateTableModal';
import { useToast } from '../components/ui/toast';
import { useTableStore } from '../stores/tableStore';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}
const Card = ({ children, className, onClick }: CardProps) => (
  <button
    type="button"
    className={`border rounded-lg p-4 bg-white dark:bg-gray-800 shadow text-left w-full ${className || ''}`}
    onClick={onClick}
  >
    {children}
  </button>
);
const CardHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2">{children}</div>
);
const CardTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="font-semibold text-lg">{children}</h3>
);
const CardContent = ({ children }: { children: React.ReactNode }) => (
  <div className="text-sm">{children}</div>
);
const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className || ''}`} />
);

export function LobbyPage() {
  const navigate = useNavigate();
  const { tables, isLoading, error, lastFetched, refresh, clearError } = useTableStore();
  const [modalOpen, setModalOpen] = useState(false);
  const { show: showToast, ToastContainer } = useToast();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleTableClick = useCallback(
    (tableId: string) => {
      navigate(`/table/${tableId}`);
    },
    [navigate],
  );

  const handleRefresh = useCallback(() => {
    refresh().catch((err) => {
      console.error('Refresh failed:', err);
      showToast('Failed to refresh lobby. Check network.');
    });
  }, [refresh, showToast]);

  // Show error toasts
  useEffect(() => {
    if (error) {
      showToast(error);
      clearError();
    }
  }, [error, showToast, clearError]);

  // Initial load if data is stale
  useEffect(() => {
    if (!lastFetched || Date.now() - lastFetched > 30000) {
      handleRefresh();
    }
  }, [lastFetched, handleRefresh]);

  // Visibility-aware polling
  useEffect(() => {
    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          handleRefresh();
        }
      }, 30000);
    };
    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    startPolling();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startPolling();
        handleRefresh();
      } else {
        stopPolling();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleRefresh]);

  return (
    <div className="container mx-auto p-4">
      <ToastContainer />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Lobby</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="px-3 py-2 border rounded-md disabled:opacity-50"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Create Table
          </button>
        </div>
      </div>

      {isLoading && tables.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((num) => (
            <Card key={num}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tables.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          No tables available. Create one to start playing!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tables.map((table) => (
            <Card
              key={table.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleTableClick(table.id)}
            >
              <CardHeader>
                <CardTitle>{table.name || `Table ${table.id.slice(0, 8)}`}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div>Stake: {table.stake_level}</div>
                  <div>
                    Players: {table.current_players}/{table.max_players}
                  </div>
                  <div>Status: {table.status}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateTableModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
