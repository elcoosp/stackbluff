/**
 * /table/[tableId] — fullscreen game route (frozen navigation map:
 * /table/[tableId] on the root Stack, header hidden by _layout).
 *
 * Wires the platform pieces around TableScene:
 *   • TableViewportProvider (measured table viewport + isMobile contract)
 *   • useGameWebSocket(tableId) from @stackbluff/shared (A4 hook; token +
 *     ws base URL come from the configured platform surface / bridge)
 *   • orientation: portrait while observing, landscape-capable once the
 *     hero is seated (expo-screen-orientation, restored on unmount)
 *   • back-leave confirm while seated is handled inside TableScene
 *     (BackHandler → LeaveTableDialog) so the dialog stays single-owned.
 */
import { useGameWebSocket } from '@stackbluff/shared/src/hooks/useGameWebSocket';
import { useActiveRoom } from '@stackbluff/shared/src/stores/gameStore';
import { TableViewportProvider } from '@stackbluff/ui-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useCallback, useEffect } from 'react';
import { TableScene } from '../../components/table';

export default function TableRoute() {
  const params = useLocalSearchParams<{
    tableId: string;
    observe?: string | string[];
    tournamentId?: string | string[];
    buyIn?: string | string[];
    clubId?: string | string[];
  }>();
  const router = useRouter();

  const tableId = Array.isArray(params.tableId) ? params.tableId[0] : params.tableId;
  const observeParam = Array.isArray(params.observe) ? params.observe[0] : params.observe;
  const tournamentParam = Array.isArray(params.tournamentId)
    ? params.tournamentId[0]
    : params.tournamentId;
  const buyInParam = Array.isArray(params.buyIn) ? params.buyIn[0] : params.buyIn;
  const clubIdParam = Array.isArray(params.clubId) ? params.clubId[0] : params.clubId;

  const isObserving = observeParam === 'true';
  const urlBuyIn = buyInParam ? Number(buyInParam) : null;

  const ws = useGameWebSocket(tableId ?? '');

  /* ── Orientation: allow landscape once seated, portrait otherwise ───── */
  const game = useActiveRoom();
  const isHeroSeated =
    !!ws.myUserId && Object.values(game.seats).some((s) => s.user_id === ws.myUserId);

  useEffect(() => {
    if (isHeroSeated) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.ALL).catch(() => {});
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    }
  }, [isHeroSeated]);

  useEffect(() => {
    return () => {
      // Leaving the table: restore the app-wide portrait lock.
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  /* ── Leave navigation (PWA: navigate to /lobby) ─────────────────────── */
  const handleLeave = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [router]);

  if (!tableId) {
    return null;
  }

  return (
    <TableViewportProvider>
      <TableScene
        tableId={tableId}
        ws={ws}
        isObserving={isObserving}
        tournamentId={tournamentParam ?? null}
        urlBuyIn={urlBuyIn}
        clubId={clubIdParam ?? null}
        onLeave={handleLeave}
      />
    </TableViewportProvider>
  );
}
