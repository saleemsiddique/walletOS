import { describe, it, expect } from 'vitest';
import { signAccessToken, verifyAccessToken } from '../lib/jwt';
import { UnauthorizedError } from '../middleware/errorHandler';

describe('jwt', () => {
  const payload = { userId: 'user-123' };

  it('sign → verify round-trip returns correct userId', () => {
    const token = signAccessToken(payload);
    const result = verifyAccessToken(token);
    expect(result.userId).toBe(payload.userId);
  });

  it('throws UnauthorizedError for a tampered token', () => {
    const token = signAccessToken(payload);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => verifyAccessToken(tampered)).toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError for a token signed with a different secret', () => {
    // Craft a token manually with wrong secret by altering signature
    const parts = signAccessToken(payload).split('.');
    const fakeToken = parts[0] + '.' + parts[1] + '.invalidsignature';
    expect(() => verifyAccessToken(fakeToken)).toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError for a malformed token', () => {
    expect(() => verifyAccessToken('not.a.jwt')).toThrow(UnauthorizedError);
  });
});
