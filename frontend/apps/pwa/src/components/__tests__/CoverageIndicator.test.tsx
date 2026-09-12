import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CoverageIndicator } from '../CoverageIndicator';

describe('CoverageIndicator', () => {
  it('shows documentation links when component is covered', () => {
    const coveredComponent = (
      <CoverageIndicator isCovered={true}>
        <span>Covered Component</span>
      </CoverageIndicator>
    );

    render(coveredComponent);

    // A covered component should show external documentation links
    const links = screen.queryAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
  });

  it('shows no documentation links when component is not covered', () => {
    const uncoveredComponent = (
      <CoverageIndicator isCovered={false}>
        <span>Uncovered Component</span>
      </CoverageIndicator>
    );

    render(uncoveredComponent);

    // An uncovered component should not show external documentation links
    const links = screen.queryAllByRole('link');
    expect(links.length).toBe(0);
  });

  it('uses data attribute to indicate coverage status', () => {
    const component = (
      <CoverageIndicator isCovered={true}>
        <span>Test Component</span>
      </CoverageIndicator>
    );

    render(component);

    // Check for data attribute that indicates coverage
    const element = screen.getByTestId('coverage-indicator');
    expect(element).toHaveAttribute('data-coverage-status');
    expect(element.getAttribute('data-coverage-status')).toBe('covered');
  });

  it('does not render coverage overlay for uninstrumented components', () => {
    const uninstrumentedComponent = (
      <CoverageIndicator isCovered={false}>
        <span>Uninstrumented Component</span>
      </CoverageIndicator>
    );

    render(uninstrumentedComponent);

    // Check that the coverage overlay is NOT present
    const coverageOverlay = document.querySelector('[data-coverage-overlay]');
    expect(coverageOverlay).toBeNull();

    // Also verify no documentation links are shown
    const links = screen.queryAllByRole('link');
    expect(links.length).toBe(0);
  });
});
