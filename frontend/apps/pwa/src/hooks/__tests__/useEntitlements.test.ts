import { describe, it, expect, beforeEach } from 'vitest';
import { useEntitlementsStore } from '../../stores/entitlementsStore';

beforeEach(() => {
  useEntitlementsStore.setState({
    seasonPassExpiresAt: null,
    clubProExpiresAt: null,
    isClubOwner: false,
  });
});

describe('useEntitlementsStore', () => {
  it('hasActiveSeasonPass returns false when no pass', () => {
    expect(useEntitlementsStore.getState().hasActiveSeasonPass()).toBe(false);
  });

  it('hasActiveSeasonPass returns true for future date', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    useEntitlementsStore.getState().setSeasonPassExpiresAt(future);
    expect(useEntitlementsStore.getState().hasActiveSeasonPass()).toBe(true);
  });

  it('hasActiveSeasonPass returns false for expired date', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    useEntitlementsStore.getState().setSeasonPassExpiresAt(past);
    expect(useEntitlementsStore.getState().hasActiveSeasonPass()).toBe(false);
  });

  it('hasActiveSeasonPass returns false for invalid date', () => {
    useEntitlementsStore.getState().setSeasonPassExpiresAt('invalid');
    expect(useEntitlementsStore.getState().hasActiveSeasonPass()).toBe(false);
  });

  it('hasActiveClubPro returns false when no pro', () => {
    expect(useEntitlementsStore.getState().hasActiveClubPro()).toBe(false);
  });

  it('hasActiveClubPro returns true for future date', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    useEntitlementsStore.getState().setClubProExpiresAt(future);
    expect(useEntitlementsStore.getState().hasActiveClubPro()).toBe(true);
  });
});
