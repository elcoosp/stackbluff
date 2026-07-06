import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameHandCompletion } from '../routes/table/useGameHandCompletion';
import { useConsentStore } from '@/stores/consentStore';
import { FIRST_HAND_PLAYED_KEY } from '@/lib/consent/constants';

// Mock the game store
const mockUseActiveRoom = vi.fn();
vi.mock('@stackbluff/shared/stores/gameStore', () => ({
  useActiveRoom: () => mockUseActiveRoom(),
  useGameStore: {
    getState: vi.fn(),
  },
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useGameHandCompletion integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    useConsentStore.setState({
      notificationConsent: 'not_asked',
    });
  });

  it('should mark first hand complete when showdownReveal transitions from object to null', () => {
    // Initial state: showdownReveal is an object (showdown happening)
    const mockActiveRoom = {
      id: 'room-1',
      showdownReveal: { handId: 'hand-1', winners: [] },
      handInProgress: true,
    };

    mockUseActiveRoom.mockReturnValue(mockActiveRoom);

    const { rerender } = renderHook(() => useGameHandCompletion());

    // First render: showdownReveal is set
    expect(localStorageMock.setItem).not.toHaveBeenCalled();

    // Transition: showdownReveal becomes null (hand ended)
    mockUseActiveRoom.mockReturnValue({
      ...mockActiveRoom,
      showdownReveal: null,
    });

    rerender();

    // Should have marked first hand complete
    expect(localStorageMock.setItem).toHaveBeenCalledWith(FIRST_HAND_PLAYED_KEY, 'true');
  });

  it('should mark first hand complete when handInProgress transitions from true to false', () => {
    const mockActiveRoom = {
      id: 'room-1',
      showdownReveal: null,
      handInProgress: true,
    };

    mockUseActiveRoom.mockReturnValue(mockActiveRoom);

    const { rerender } = renderHook(() => useGameHandCompletion());

    // Transition: handInProgress becomes false
    mockUseActiveRoom.mockReturnValue({
      ...mockActiveRoom,
      handInProgress: false,
    });

    rerender();

    expect(localStorageMock.setItem).toHaveBeenCalledWith(FIRST_HAND_PLAYED_KEY, 'true');
  });

  it('should not mark again if already played', () => {
    localStorageMock.setItem(FIRST_HAND_PLAYED_KEY, 'true');
    localStorageMock.getItem.mockReturnValue('true');

    const mockActiveRoom = {
      id: 'room-1',
      showdownReveal: { handId: 'hand-1' },
      handInProgress: true,
    };

    mockUseActiveRoom.mockReturnValue(mockActiveRoom);

    const { rerender } = renderHook(() => useGameHandCompletion());

    // Transition
    mockUseActiveRoom.mockReturnValue({
      ...mockActiveRoom,
      showdownReveal: null,
    });

    rerender();

    // Should NOT call setItem again (already played)
    // Note: setItem is only called once in beforeEach via clear, so count should be 0 or 1
    const setItemCalls = localStorageMock.setItem.mock.calls.filter(
      (call: any[]) => call[0] === FIRST_HAND_PLAYED_KEY
    );
    expect(setItemCalls.length).toBe(0); // Already set before hook ran
  });

  it('should reset tracking when room changes', () => {
    // First room
    const room1 = {
      id: 'room-1',
      showdownReveal: { handId: 'hand-1' },
      handInProgress: true,
    };

    mockUseActiveRoom.mockReturnValue(room1);
    const { rerender } = renderHook(() => useGameHandCompletion());

    // Change to new room
    const room2 = {
      id: 'room-2',
      showdownReveal: null,
      handInProgress: false,
    };

    mockUseActiveRoom.mockReturnValue(room2);
    rerender();

    // Should NOT mark complete because room changed (reset tracking)
    const setItemCalls = localStorageMock.setItem.mock.calls.filter(
      (call: any[]) => call[0] === FIRST_HAND_PLAYED_KEY
    );
    expect(setItemCalls.length).toBe(0);
  });
});
