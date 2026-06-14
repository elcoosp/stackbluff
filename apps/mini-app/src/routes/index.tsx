import { createFileRoute, Link } from '@tanstack/react-router';
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

// Static table data – no API calls, no infinite loops
const tables: Table[] = [
  { id: '1', name: 'Vegas Vault', stakes: '200/400', players: 6, maxPlayers: 9 },
  { id: '2', name: 'Obsidian Room', stakes: '500/1000', players: 4, maxPlayers: 6 },
  { id: '3', name: 'Emerald Lounge', stakes: '100/200', players: 8, maxPlayers: 9 },
];

export const Route = createFileRoute('/')({
  component: LobbyPage,
});

function LobbyPage() {
  return (
    <div className="min-h-screen bg-background p-8" style={{ background: 'radial-gradient(circle at center, #1a1c1b 0%, #131313 100%)' }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display-lg text-4xl text-on-surface mb-2">STACKBLUFF</h1>
          <p className="text-on-surface-variant">Select a table to join the game</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tables.map((table) => (
            <GlassHub key={table.id} active={false}>
              <Card className="bg-transparent border-0 shadow-none">
                <CardHeader>
                  <CardTitle className="text-on-surface">{table.name}</CardTitle>
                  <div className="text-tertiary text-sm font-mono">{table.stakes}</div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-on-surface-variant text-sm mb-4">
                    <span>Players: {table.players}/{table.maxPlayers}</span>
                    <span>Status: {table.players === table.maxPlayers ? 'Full' : 'Open'}</span>
                  </div>
                  <Link to="/table/$tableId" params={{ tableId: table.id }}>
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
}
