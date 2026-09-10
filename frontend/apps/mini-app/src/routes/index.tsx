import { getToken, isAuthenticated } from '@stackbluff/shared/auth/token';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GlassHub } from '../components/game';

interface Table {
  table_id: string;
  stake_level: string;
  current_players: number;
  max_players: number;
  status?: string;
}

const fetchTables = async () => {
  const token = getToken();
  const res = await fetch('/api/lobby', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json();
};

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (!isAuthenticated()) throw redirect({ to: '/login' });
  },
  component: function LobbyPage() {
    const {
      data: tables,
      isLoading,
      error,
      refetch,
    } = useQuery({
      queryKey: ['tables'],
      queryFn: fetchTables,
      staleTime: 30000,
      refetchOnWindowFocus: false,
      retry: 1,
    });

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen text-white pt-20">
          Loading tables...
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen pt-20 text-center px-4">
          {/* Glass panel error card – matching Obsidian Steel */}
          <div className="glass-hub rounded-xl p-6 max-w-md w-full border border-tertiary/20">
            <div className="flex flex-col items-center gap-4">
              <span className="material-symbols-outlined text-error text-5xl">error</span>
              <h2 className="font-display-lg text-xl text-on-surface">Connection Failed</h2>
              <p className="font-data-mono text-sm text-on-surface-variant">{error.message}</p>
              <p className="text-xs text-outline">
                Make sure the backend server is running on port 3000.
              </p>
              <Button
                onClick={() => refetch()}
                className="mt-2 bg-tertiary text-on-tertiary hover:bg-tertiary/80"
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background pt-20 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="font-display-lg text-4xl text-on-surface mb-2">STACKBLUFF</h1>
          <p className="text-on-surface-variant mb-8">Select a table to join the game</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tables?.map((table: Table) => (
              <GlassHub key={table.table_id} active={false}>
                <Card className="bg-surface-container/40 border-outline-variant/20 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-on-surface">Table {table.table_id}</CardTitle>
                    <div className="text-tertiary text-sm font-mono">{table.stake_level}</div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-on-surface-variant text-sm mb-4">
                      <span>
                        Players: {table.current_players}/{table.max_players}
                      </span>
                      <span>Status: {table.status || 'Open'}</span>
                    </div>
                    <Link to="/table/$tableId" params={{ tableId: table.table_id }}>
                      <Button className="w-full bg-tertiary text-on-tertiary hover:bg-tertiary/80">
                        Join Table
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </GlassHub>
            ))}
          </div>
        </div>
      </div>
    );
  },
});
