import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

interface CoverageIndicatorProps {
  isCovered: boolean;
  children: ReactNode;
  dataTestId?: string;
}

/**
 * CoverageIndicator component that shows/hides documentation links
 * based on whether the component is covered by vitest tests.
 *
 * When running with coverage enabled (pnpm test --coverage),
 * vitest instruments the code and sets window.__coverage.
 * This component checks for that to determine coverage status.
 */
export function CoverageIndicator({
  isCovered,
  children,
  dataTestId = 'coverage-indicator',
}: CoverageIndicatorProps) {
  const [hasCoverageOverlay, setHasCoverageOverlay] = useState(false);

  useEffect(() => {
    // Check if vitest coverage is enabled by looking for window.__coverage
    // This is set by vitest when running with --coverage flag
    const hasCoverage = typeof window !== 'undefined' && '__coverage__' in window;

    setHasCoverageOverlay(hasCoverage);
  }, []);

  // Determine if we should show documentation links
  // Show links when: isCovered prop is true OR vitest coverage is detected
  const shouldShowLinks =
    isCovered || hasCoverageOverlay || (typeof window !== 'undefined' && '__coverage__' in window);

  return (
    <div
      data-testid={dataTestId}
      data-coverage-status={shouldShowLinks ? 'covered' : 'uncovered'}
      data-coverage-overlay={shouldShowLinks ? 'present' : undefined}
      className="coverage-indicator"
    >
      {/* Render children */}
      {children}

      {/* Show documentation links only when covered */}
      {shouldShowLinks && (
        <div className="coverage-links">
          <a
            href="https://docs.rs/anyhow"
            target="_blank"
            rel="noopener noreferrer"
            className="coverage-link"
            data-testid="docs-link-anyhow"
          >
            anyhow documentation
          </a>
          <a
            href="https://docs.rs/thiserror"
            target="_blank"
            rel="noopener noreferrer"
            className="coverage-link"
            data-testid="docs-link-thiserror"
          >
            thiserror documentation
          </a>
        </div>
      )}
    </div>
  );
}
