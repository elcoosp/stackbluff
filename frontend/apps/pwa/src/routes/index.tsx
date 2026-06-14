import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GlassHub } from '../components/game';

interface Table {
  id: string;
  name: string;
  stakes: string;
  players: number;
  maxPlayers: number;
}

const fetchTables = async (): Promise<Table[]> => {
  return [
    { id: '1', name: 'Vegas Vault', stakes: '200/400', players: 6, maxPlayers: 9 },
    { id: '2', name: 'Obsidian Room', stakes: '500/1000', players: 4, maxPlayers: 6 },
    { id: '3', name: 'Emerald Lounge', stakes: '100/200', players: 8, maxPlayers: 9 },
  ];
};

export const Route = createFileRoute('/')({
  component: function LobbyPage() {
    const { data: tables, isLoading, error } = useQuery({
      queryKey: ['tables'],
      queryFn: fetchTables,
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    });

    if (isLoading) return <div className="flex items-center justify-center h-screen text-white">Loading tables...</div>;
    if (error) return (
      <div className="flex flex-col items-center justify-center h-screen text-red-500">
        <p>Failed to load tables.</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">Retry</Button>
      </div>
    );

    return (
      <div className="min-h-screen bg-[#131313] p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">STACKBLUFF</h1>
            <p className="text-gray-400">Select a table to join the game</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tables?.map((table) => (
              <GlassHub key={table.id} active={false}>
                <Card className="bg-black/40 border-white/10 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-white">{table.name}</CardTitle>
                    <div className="text-emerald-400 text-sm font-mono">{table.stakes}</div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-gray-400 text-sm mb-4">
                      <span>Players: {table.players}/{table.maxPlayers}</span>
                      <span>Status: {table.players === table.maxPlayers ? 'Full' : 'Open'}</span>
                    </div>
                    <Link to="/table/$tableId" params={{ tableId: table.id }}>
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
