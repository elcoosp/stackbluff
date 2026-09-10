/**
 * Vitest setup file.
 * Runs before each test suite to configure the test environment.
 */

import '@testing-library/jest-dom';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock IntersectionObserver
const IntersectionObserverMock = class {
  observe(): null {
    return null;
  }
  disconnect(): null {
    return null;
  }
  unobserve(): null {
    return null;
  }
};
Object.defineProperty(window, 'IntersectionObserver', {
  value: IntersectionObserverMock,
  writable: true,
  configurable: true,
});

// Mock ResizeObserver
const ResizeObserverMock = class {
  observe(): null {
    return null;
  }
  disconnect(): null {
    return null;
  }
  unobserve(): null {
    return null;
  }
};
Object.defineProperty(window, 'ResizeObserver', {
  value: ResizeObserverMock,
  writable: true,
  configurable: true,
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Clear localStorage before each test
beforeEach(() => {
  localStorageMock.clear();
});
jest.mock('@stackbluff/shared/api/client', () => ({
  apiClient: { post: jest.fn(), get: jest.fn() },
}));
