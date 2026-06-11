import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTableStore } from '../stores/tableStore';
import { CreateTableModal } from '../components/CreateTableModal';

// Simple fallback components (shadcn/ui will be used if available)
const Card = ({ children, className, onClick }: any) => (
  <div className={`border rounded-lg p-4 bg-white dark:bg-gray-800 shadow ${className}`} onClick={onClick}>{children}</div>
);
const CardHeader = ({ children }: any) => <div className="mb-2">{children}</div>;
const CardTitle = ({ children }: any) => <h3 className="font-semibold text-lg">{children}</h3>;
const CardContent = ({ children }: any) => <div className="text-sm">{children}</div>;
const Skeleton = ({ className }: any) => <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`} />;

export function LobbyPage() {
  const navigate = useNavigate();
  const { tables, isLoading, refresh, lastFetched } = useTableStore();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!lastFetched || Date.now() - lastFetched > 30000) {
      refresh();
    }
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh, lastFetched]);

  const handleTableClick = (tableId: string) => {
    navigate(`/table/${tableId}`);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Lobby</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Create Table
        </button>
      </div>

      {isLoading && tables.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
              <CardContent><Skeleton className="h-4 w-full" /></CardContent>
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
                <CardTitle>{table.name || `Table ${table.id.slice(0,8)}`}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div>Stake: {table.stake_level}</div>
                  <div>Players: {table.current_players}/{table.max_players}</div>
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
