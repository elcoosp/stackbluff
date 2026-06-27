import { useEntitlementsStore } from '../stores/entitlementsStore';

export function useHasActiveSeasonPass(): boolean {
  return useEntitlementsStore((s) => s.hasActiveSeasonPass());
}

export function useHasActiveClubPro(): boolean {
  return useEntitlementsStore((s) => s.hasActiveClubPro());
}

export function useIsClubOwner(): boolean {
  return useEntitlementsStore((s) => s.isClubOwner);
}

export function useSeasonPassExpiry(): string | null {
  return useEntitlementsStore((s) => s.seasonPassExpiresAt);
}

export function useClubProExpiry(): string | null {
  return useEntitlementsStore((s) => s.clubProExpiresAt);
}
