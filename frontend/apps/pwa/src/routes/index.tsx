import { createFileRoute, redirect } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { isAuthenticated } from '@stackbluff/shared/auth/token';
import { GlassHub } from '../components/game';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from '@tanstack/react-router';

const fetchTables = async () => {
  const response = await fetch('/api/lobby');
  if (!response.ok) throw new Error('Failed to fetch tables');
  return response.json();
};

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: '/login' });
    }
  },
  component: LobbyPage,
});

function LobbyPage() {
  const { data: tables, isLoading, error, refetch } = useQuery({
    queryKey: ['tables'],
    queryFn: fetchTables,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <div className="text-white text-center mt-20">Loading tables...</div>;
  if (error) return <div className="text-red-500 text-center mt-20">Error loading tables</div>;

  return (
    <div className="min-h-screen bg-[#131313] p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">STACKBLUFF</h1>
        <p className="text-gray-400 mb-8">Select a table to join the game</p>
        <div className="grid gap-6">
          {tables?.map((table: any) => (
            <GlassHub key={table.table_id}>
              <Card className="bg-black/40 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white">Table {table.table_id}</CardTitle>
                  <div className="text-emerald-400 text-sm">{table.stake_level}</div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-gray-400 text-sm mb-4">
                    <span>Players: {table.current_players}/{table.max_players}</span>
                    <span>Status: {table.status}</span>
                  </div>
                  <Link to="/table/$tableId" params={{ tableId: table.table_id }}>
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700">Join Table</Button>
                  </Link>
                </CardContent>
              </Card>
            </GlassHub>
          ))}
        </div>
      </div>
    </div>
  );
}
