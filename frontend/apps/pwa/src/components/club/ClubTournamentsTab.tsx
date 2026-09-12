import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle, Coins, Plus, RotateCcw, Users, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useClubTournaments } from '../../hooks/useClubTournaments';
import type { Tournament } from '../../lib/schemas';
import { ScheduleTournamentDialog } from './ScheduleTournamentDialog';

interface ClubTournamentsTabProps {
  clubId: string;
  isOwner?: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function TournamentCard({
  tournament,
  onRegister,
  onUnregister,
  isRegistering,
  isUnregistering,
}: {
  tournament: Tournament;
  onRegister: (id: string, name: string) => void;
  onUnregister: (id: string, name: string) => void;
  isRegistering: boolean;
  isUnregistering: boolean;
}) {
  const startDate = tournament.scheduled_start ? new Date(tournament.scheduled_start) : null;
  const isFull = tournament.current_registrations >= tournament.max_players;
  const spotsLeft = tournament.max_players - tournament.current_registrations;

  return (
    <Card className="p-6 bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl hover:bg-white/[0.07] transition-colors">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="flex-grow space-y-4">
          <h3 className="font-headline-md text-lg text-on-surface">{tournament.name}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-tertiary" />
              </div>
              <div>
                <p className="text-xs font-data-mono uppercase tracking-widest text-on-surface-variant">
                  <Trans>Date & Time</Trans>
                </p>
                <p className="text-on-surface font-medium text-sm mt-0.5">
                  {startDate
                    ? `${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : '—'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                <Coins className="w-4 h-4 text-yellow-400" />
              </div>
              <div>
                <p className="text-xs font-data-mono uppercase tracking-widest text-on-surface-variant">
                  <Trans>Buy-in</Trans>
                </p>
                <p className="text-on-surface font-medium text-sm mt-0.5">
                  {tournament.buy_in.toLocaleString()} <Trans>chips</Trans>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-data-mono uppercase tracking-widest text-on-surface-variant">
                  <Trans>Players</Trans>
                </p>
                <p className="text-on-surface font-medium text-sm mt-0.5">
                  {tournament.current_registrations} / {tournament.max_players}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                {tournament.status === 'Registering' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <RotateCcw className="w-4 h-4 text-purple-400" />
                )}
              </div>
              <div>
                <p className="text-xs font-data-mono uppercase tracking-widest text-on-surface-variant">
                  <Trans>Status</Trans>
                </p>
                <p
                  className={cn(
                    'font-medium text-sm mt-0.5',
                    tournament.status === 'Registering' ? 'text-emerald-400' : 'text-purple-400',
                  )}
                >
                  {tournament.status}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 w-full md:w-auto">
          {tournament.is_registered ? (
            <Button
              onClick={() => onUnregister(tournament.id, tournament.name)}
              disabled={isUnregistering}
              variant="outline"
              className="w-full px-4 py-3 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 font-label-caps text-xs uppercase tracking-wider rounded-xl justify-center"
            >
              <XCircle className="w-4 h-4 mr-2" />
              {isUnregistering ? <Trans>Unregistering</Trans> : <Trans>Unregister</Trans>}
            </Button>
          ) : (
            <Button
              onClick={() => onRegister(tournament.id, tournament.name)}
              disabled={isFull || isRegistering}
              className="w-full px-4 py-3 bg-tertiary text-on-tertiary font-label-caps text-xs hover:bg-tertiary-fixed uppercase tracking-wider shadow-lg shadow-emerald-500/10 rounded-xl justify-center disabled:opacity-40"
            >
              {isRegistering ? (
                <>
                  <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                  <Trans>Registering</Trans>
                </>
              ) : isFull ? (
                <Trans>Tournament Full</Trans>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  <Trans>Register ({spotsLeft} left)</Trans>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function ClubTournamentsTab({ clubId, isOwner }: ClubTournamentsTabProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data, isLoading, error, register, unregister, isRegistering, isUnregistering } =
    useClubTournaments(clubId);

  const handleRegister = async (tournamentId: string, tournamentName: string) => {
    try {
      await register(tournamentId);
      toast.success(t`Registered for "${tournamentName}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t`Failed to register`);
    }
  };

  const handleUnregister = async (tournamentId: string, tournamentName: string) => {
    try {
      await unregister(tournamentId);
      toast.success(t`Unregistered from "${tournamentName}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t`Failed to unregister`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-on-surface-variant">
          <Trans>Loading tournaments...</Trans>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-red-500/5 border border-red-500/20 rounded-2xl">
        <h3 className="font-headline-md text-lg text-red-400 mb-2">
          <Trans>Error Loading Tournaments</Trans>
        </h3>
        <p className="text-on-surface-variant text-sm">
          {error instanceof Error ? error.message : t`Failed to load tournaments`}
        </p>
      </Card>
    );
  }

  const tournaments = data?.tournaments ?? [];
  const upcomingTournaments = tournaments.filter(
    (t: Tournament) => t.status === 'Scheduled' || t.status === 'Registering',
  );
  const pastTournaments = tournaments.filter((t: Tournament) => t.status === 'Completed');

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-tertiary" />
            <span className="text-xs font-data-mono uppercase tracking-widest text-tertiary">
              <Trans>Events</Trans>
            </span>
          </div>
          <h2 className="font-headline-md text-xl text-on-surface">
            <Trans>Tournaments</Trans>
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            <Trans>
              {upcomingTournaments.length} upcoming tournament
              {upcomingTournaments.length !== 1 ? 's' : ''}
            </Trans>
          </p>
        </div>
        {isOwner && (
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-3 bg-tertiary text-on-tertiary font-label-caps text-xs hover:bg-tertiary-fixed uppercase tracking-wider shadow-lg shadow-emerald-500/10 rounded-xl w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            <Trans>Schedule Tournament</Trans>
          </Button>
        )}
      </div>

      {upcomingTournaments.length === 0 ? (
        <div className="text-center py-16 bg-white/5 border border-white/10 rounded-2xl">
          <p className="text-on-surface-variant">
            <Trans>No upcoming tournaments scheduled</Trans>
          </p>
          {isOwner && (
            <p className="text-on-surface-variant/60 text-sm mt-2">
              <Trans>Click "Schedule Tournament" to create one!</Trans>
            </p>
          )}
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          {upcomingTournaments.map((tournament: Tournament) => (
            <motion.div key={tournament.id} variants={itemVariants}>
              <TournamentCard
                tournament={tournament}
                onRegister={handleRegister}
                onUnregister={handleUnregister}
                isRegistering={isRegistering}
                isUnregistering={isUnregistering}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {pastTournaments.length > 0 && (
        <div className="mt-10">
          <h3 className="font-headline-md text-lg text-on-surface-variant mb-4 flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> <Trans>Past Tournaments</Trans>
          </h3>
          <div className="space-y-2">
            {pastTournaments.slice(0, 5).map((tournament: Tournament) => (
              <div
                key={tournament.id}
                className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl opacity-70 hover:opacity-100 transition-opacity"
              >
                <div>
                  <p className="text-on-surface font-medium text-sm">{tournament.name}</p>
                  <p className="text-on-surface-variant text-xs mt-1">
                    {tournament.scheduled_start
                      ? new Date(tournament.scheduled_start).toLocaleDateString()
                      : '—'}
                  </p>
                </div>
                <span className="text-xs font-data-mono uppercase tracking-widest text-on-surface-variant px-3 py-1 bg-white/5 rounded-full border border-white/10">
                  <Trans>Completed</Trans>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ScheduleTournamentDialog
        clubId={clubId}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </div>
  );
}
