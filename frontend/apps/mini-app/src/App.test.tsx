import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('Mini App', () => {
  it('renders the app title', () => {
    render(<App />);
    expect(screen.getByText(/StackBluff Mini App/i)).toBeInTheDocument();
  });
});
