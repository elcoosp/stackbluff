import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('Mini App', () => {
  it('renders the lobby page', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /lobby/i })).toBeInTheDocument();
  });
});
