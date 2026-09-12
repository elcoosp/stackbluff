import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithI18n } from './__tests__/renderWithI18n';
import App from './App';

describe('PWA App', () => {
  it('renders the app title', () => {
    renderWithI18n(<App />);
    expect(screen.getByText(/StackBluff PWA/i)).toBeInTheDocument();
  });
});
