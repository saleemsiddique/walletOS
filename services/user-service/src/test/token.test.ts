import { describe, it, expect } from 'vitest';
import { generateOpaqueToken, hashToken } from '../lib/token';

describe('token', () => {
  it('generateOpaqueToken produces a 64-character hex string', () => {
    const token = generateOpaqueToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generateOpaqueToken produces different values on each call', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
  });

  it('hashToken is deterministic for the same input', () => {
    const token = generateOpaqueToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it('hashToken produces different hashes for different tokens', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(hashToken(a)).not.toBe(hashToken(b));
  });
});
