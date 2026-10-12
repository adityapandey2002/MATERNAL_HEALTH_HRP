import { describe, it, expect, vi } from 'vitest';
import { authRoutes } from './auth.js';

describe('Auth Routes', () => {
  it('should export auth routes', () => {
    expect(authRoutes).toBeDefined();
    expect(typeof authRoutes).toBe('function');
  });
});