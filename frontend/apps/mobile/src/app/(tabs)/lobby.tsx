import { LobbyScreen } from '../../screens/LobbyScreen';

/**
 * `/lobby` — alias of the Lobby tab (frozen navigation map: /lobby →
 * (tabs)/lobby). The tab bar itself uses `(tabs)/index` as the Lobby tab;
 * this file makes the `/lobby` path (deep links, auth redirects) resolvable
 * and is hidden from the tab bar via `href: null` in the tabs layout.
 */
export default function LobbyAliasRoute() {
  return <LobbyScreen />;
}
