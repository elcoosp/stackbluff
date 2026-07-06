import { useClubTournaments, type Tournament } from '../../hooks/useClubTournaments';
import { Card } from '@stackbluff/shared/ui/Card';
import { toast } from 'sonner';

interface ClubTournamentsTabProps {
  clubId: string;
  isOwner?: boolean;
}

export function ClubTournamentsTab({ clubId, isOwner }: ClubTournamentsTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const {
    data,
    isLoading,
    error,
    register,
    unregister,
    isRegistering,
    isUnregistering,
  } = useClubTournaments(clubId);

  const handleRegister = async (tournamentId: string, tournamentName: string) => {
    try {
      await register(tournamentId);
      toast.success(`Registered for "${tournamentName}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to register');
    }
  };

  const handleUnregister = async (tournamentId: string, tournamentName: string) => {
    try {
      await unregister(tournamentId);
      toast.success(`Unregistered from "${tournamentName}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unregister');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white/60">Loading tournaments...</div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Error</h3>
        <p className="text-white/60">
          {error instanceof Error ? error.message : 'Failed to load tournaments'}
        </p>
      </Card>
    );
  }

  const tournaments = data?.tournaments ?? [];
  const upcomingTournaments = tournaments.filter(
    (t) => t.status === 'Scheduled' || t.status === 'Registering'
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Tournaments</h2>
          <p className="text-white/60 text-sm">
            {upcomingTournaments.length} upcoming tournament
            {upcomingTournaments.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => {
              // TODO: Open ScheduleTournamentDialog in next step
              setIsDialogOpen(true);
            }}
            className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg text-white font-medium transition-all shadow-lg"
          >
            + Schedule Tournament
          </button>
        )}
      </div>

      {/* Tournament list */}
      {upcomingTournaments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/60">No upcoming tournaments</p>
          {isOwner && (
            <p className="text-white/40 text-sm mt-2">
              Click "Schedule Tournament" to create one!
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {upcomingTournaments.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              onRegister={handleRegister}
              onUnregister={handleUnregister}
              isRegistering={isRegistering}
              isUnregistering={isUnregistering}
            />
          ))}
        </div>
      )}

      {/* Past tournaments section */}
      {tournaments.filter((t) => t.status === 'Completed').length > 0 && (
        <div className="mt-8 pt-6 border-t border-white/10">
          <h3 className="text-lg font-semibold text-white/80 mb-4">
            Past Tournaments
          </h3>
          <div className="space-y-2">
            {tournaments
              .filter((t) => t.status === 'Completed')
              .slice(0, 5)
              .map((tournament) => (
                <div
                  key={tournament.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg opacity-60"
                >
                  <div>
                    <p className="text-white/80 font-medium">{tournament.name}</p>
                    <p className="text-white/40 text-sm">
                      {new Date(tournament.scheduled_start).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-white/40 text-sm">Completed</span>
                </div>
              ))}
          </div>
        </div>
      )}
      {/* Schedule Tournament Dialog */}
      <ScheduleTournamentDialog
        clubId={clubId}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </div>
  );
}

interface TournamentCardProps {
  tournament: Tournament;
  onRegister: (id: string, name: string) => void;
  onUnregister: (id: string, name: string) => void;
  isRegistering: boolean;
  isUnregistering: boolean;
}

function TournamentCard({
  tournament,
  onRegister,
  onUnregister,
  isRegistering,
  isUnregistering,
}: TournamentCardProps) {
  const startDate = new Date(tournament.scheduled_start);
  const isFull = tournament.current_registrations >= tournament.max_players;
  const spotsLeft = tournament.max_players - tournament.current_registrations;

  return (
    <Card className="p-6 hover:bg-white/5 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-grow">
          <h3 className="text-xl font-semibold text-white mb-2">
            {tournament.name}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-white/40 mb-1">Date & Time</p>
              <p className="text-white font-medium">
                {startDate.toLocaleDateString()} at{' '}
                {startDate.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div>
              <p className="text-white/40 mb-1">Buy-in</p>
              <p className="text-white font-medium">
                {tournament.buy_in.toLocaleString()} chips
              </p>
            </div>
            <div>
              <p className="text-white/40 mb-1">Players</p>
              <p className="text-white font-medium">
                {tournament.current_registrations} / {tournament.max_players}
              </p>
            </div>
            <div>
              <p className="text-white/40 mb-1">Status</p>
              <p
                className={`font-medium ${
                  tournament.status === 'Registering'
                    ? 'text-green-400'
                    : 'text-blue-400'
                }`}
              >
                {tournament.status}
              </p>
            </div>
          </div>
        </div>

        {/* Register/Unregister button */}
        <div className="flex-shrink-0">
          {tournament.is_registered ? (
            <button
              onClick={() =>
                onUnregister(tournament.id, tournament.name)
              }
              disabled={isUnregistering}
              className="px-6 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-red-400 font-medium transition-colors disabled:opacity-50"
            >
              {isUnregistering ? 'Unregistering...' : 'Unregister'}
            </button>
          ) : (
            <button
              onClick={() => onRegister(tournament.id, tournament.name)}
              disabled={isFull || isRegistering}
              className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg text-white font-medium transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRegistering
                ? 'Registering...'
                : isFull
                ? 'Full'
                : `Register (${spotsLeft} spots left)`}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
