import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GlassHub } from '../components/game';

interface Table {
  table_id: string;
  stake_level: string;
  current_players: number;
  max_players: number;
  status: string;
}

// Function to get auth token (adjust based on your auth implementation)
const getToken = () => localStorage.getItem('auth_token') || 'demo-token';

const fetchTables = async (): Promise<Table[]> => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/lobby`, {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });
  if (!response.ok) throw new Error('Failed to fetch tables');
  return response.json();
};

export const Route = createFileRoute('/')({
  component: function LobbyPage() {
    const { data: tables, isLoading, error, refetch } = useQuery({
      queryKey: ['tables'],
      queryFn: fetchTables,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    });

    if (isLoading) {
      return <div className="flex items-center justify-center h-screen text-white">Loading tables...</div>;
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-screen text-red-500">
          <p>Failed to load tables. {error.message}</p>
          <Button onClick={() => refetch()} variant="outline" className="mt-4">Retry</Button>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#131313] p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">STACKBLUFF</h1>
            <p className="text-gray-400">Select a table to join the game</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tables?.map((table) => (
              <GlassHub key={table.table_id} active={false}>
                <Card className="bg-black/40 border-white/10 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-white">Table {table.table_id}</CardTitle>
                    <div className="text-emerald-400 text-sm font-mono">{table.stake_level}</div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-gray-400 text-sm mb-4">
                      <span>Players: {table.current_players}/{table.max_players}</span>
                      <span>Status: {table.status}</span>
                    </div>
                    <Link to="/table/$tableId" params={{ tableId: table.table_id }}>
                      <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-700">
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
