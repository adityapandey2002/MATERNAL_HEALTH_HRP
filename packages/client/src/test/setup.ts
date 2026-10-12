import '@testing-library/jest-dom';
import { vi } from 'vitest';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

window.Notification = {
  permission: 'granted',
  requestPermission: vi.fn().mockResolvedValue('granted'),
} as any;

localStorage.setItem = vi.fn();
localStorage.getItem = vi.fn();
localStorage.removeItem = vi.fn();
localStorage.clear = vi.fn();