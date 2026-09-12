import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../../../__tests__/renderWithI18n';
import { SeasonPassTimer } from '../SeasonPassTimer';

describe('SeasonPassTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows remaining time for active pass', () => {
    const future = new Date(Date.now() + 86400000 + 3600000).toISOString();
    renderWithI18n(<SeasonPassTimer expiresAt={future} />);
    expect(screen.getByText(/1d 1h remaining/)).toBeInTheDocument();
  });

  it('shows expired for past date', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    renderWithI18n(<SeasonPassTimer expiresAt={past} />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('shows expired for invalid date', () => {
    renderWithI18n(<SeasonPassTimer expiresAt="invalid" />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('updates countdown over time', () => {
    const future = new Date(Date.now() + 86400000 + 7200000).toISOString();
    renderWithI18n(<SeasonPassTimer expiresAt={future} />);
    expect(screen.getByText(/1d 2h remaining/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3600000);
    });

    expect(screen.getByText(/1d 1h remaining/)).toBeInTheDocument();
  });
});
