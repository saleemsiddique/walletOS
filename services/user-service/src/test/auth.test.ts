import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { hashToken } from '../lib/token';

vi.mock('apple-signin-auth', () => ({
  default: { verifyIdToken: vi.fn() },
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn(),
}));

const app = createApp();

// ─── POST /register ──────────────────────────────────────────────────────────

describe('POST /register', () => {
  it('returns 201 with user and tokens', async () => {
    const res = await request(app)
      .post('/register')
      .send({ email: 'test@example.com', password: 'password123', name: 'Test User' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.name).toBe('Test User');
    expect(typeof res.body.access_token).toBe('string');
    expect(typeof res.body.refresh_token).toBe('string');
  });

  it('does not expose password_hash in response', async () => {
    const res = await request(app)
      .post('/register')
      .send({ email: 'test@example.com', password: 'password123', name: 'Test User' });

    expect(res.body.user.password_hash).toBeUndefined();
  });

  it('stores refresh token as hash in DB', async () => {
    const res = await request(app)
      .post('/register')
      .send({ email: 'test@example.com', password: 'password123', name: 'Test User' });

    const record = await prisma.refreshToken.findUnique({
      where: { token_hash: hashToken(res.body.refresh_token as string) },
    });
    expect(record).not.toBeNull();
  });

  it('returns 400 with invalid email', async () => {
    const res = await request(app)
      .post('/register')
      .send({ email: 'not-an-email', password: 'password123', name: 'Test User' });

    expect(res.status).toBe(400);
  });

  it('returns 400 with password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/register')
      .send({ email: 'test@example.com', password: 'short', name: 'Test User' });

    expect(res.status).toBe(400);
  });

  it('returns 400 without name', async () => {
    const res = await request(app)
      .post('/register')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(400);
  });

  it('returns 409 with duplicate email', async () => {
    await request(app)
      .post('/register')
      .send({ email: 'test@example.com', password: 'password123', name: 'Test User' });

    const res = await request(app)
      .post('/register')
      .send({ email: 'test@example.com', password: 'otherpassword', name: 'Other User' });

    expect(res.status).toBe(409);
  });
});
