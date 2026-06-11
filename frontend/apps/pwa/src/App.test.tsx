import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('PWA App', () => {
  it('renders the app title', () => {
    render(<App />);
    expect(screen.getByText(/StackBluff PWA/i)).toBeInTheDocument();
  });
});
