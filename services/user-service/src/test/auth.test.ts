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

import appleSignin from 'apple-signin-auth';

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

// ─── POST /login ─────────────────────────────────────────────────────────────

describe('POST /login', () => {
  it('returns 200 with user and tokens for valid credentials', async () => {
    await request(app)
      .post('/register')
      .send({ email: 'login@example.com', password: 'password123', name: 'Login User' });

    const res = await request(app)
      .post('/login')
      .send({ email: 'login@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('login@example.com');
    expect(typeof res.body.access_token).toBe('string');
    expect(typeof res.body.refresh_token).toBe('string');
  });

  it('returns 401 with incorrect password', async () => {
    await request(app)
      .post('/register')
      .send({ email: 'login@example.com', password: 'password123', name: 'Login User' });

    const res = await request(app)
      .post('/login')
      .send({ email: 'login@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid credentials');
  });

  it('returns 401 with non-existent email', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid credentials');
  });

  it('returns 400 with invalid body', async () => {
    const res = await request(app)
      .post('/login')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
  });
});

// ─── POST /refresh ────────────────────────────────────────────────────────────

describe('POST /refresh', () => {
  it('returns 200 with new tokens', async () => {
    const reg = await request(app)
      .post('/register')
      .send({ email: 'refresh@example.com', password: 'password123', name: 'Refresh User' });

    const res = await request(app)
      .post('/refresh')
      .send({ refresh_token: reg.body.refresh_token as string });

    expect(res.status).toBe(200);
    expect(typeof res.body.access_token).toBe('string');
    expect(typeof res.body.refresh_token).toBe('string');
    expect(res.body.refresh_token).not.toBe(reg.body.refresh_token);
  });

  it('returns 401 when reusing the old token after rotation', async () => {
    const reg = await request(app)
      .post('/register')
      .send({ email: 'refresh@example.com', password: 'password123', name: 'Refresh User' });

    const oldToken = reg.body.refresh_token as string;

    await request(app).post('/refresh').send({ refresh_token: oldToken });

    const res = await request(app).post('/refresh').send({ refresh_token: oldToken });

    expect(res.status).toBe(401);
  });

  it('returns 401 with non-existent refresh token', async () => {
    const res = await request(app)
      .post('/refresh')
      .send({ refresh_token: 'a'.repeat(64) });

    expect(res.status).toBe(401);
  });

  it('returns 401 with expired refresh token', async () => {
    const reg = await request(app)
      .post('/register')
      .send({ email: 'refresh@example.com', password: 'password123', name: 'Refresh User' });

    const tokenHash = hashToken(reg.body.refresh_token as string);
    await prisma.refreshToken.update({
      where: { token_hash: tokenHash },
      data: { expires_at: new Date(Date.now() - 1000) },
    });

    const res = await request(app)
      .post('/refresh')
      .send({ refresh_token: reg.body.refresh_token as string });

    expect(res.status).toBe(401);
  });
});

// ─── POST /logout ─────────────────────────────────────────────────────────────

describe('POST /logout', () => {
  it('returns 204 and deletes the refresh token from DB', async () => {
    const reg = await request(app)
      .post('/register')
      .send({ email: 'logout@example.com', password: 'password123', name: 'Logout User' });

    const refreshToken = reg.body.refresh_token as string;

    const res = await request(app)
      .post('/logout')
      .send({ refresh_token: refreshToken });

    expect(res.status).toBe(204);

    const record = await prisma.refreshToken.findUnique({
      where: { token_hash: hashToken(refreshToken) },
    });
    expect(record).toBeNull();
  });

  it('returns 204 even when the token does not exist (idempotent)', async () => {
    const res = await request(app)
      .post('/logout')
      .send({ refresh_token: 'a'.repeat(64) });

    expect(res.status).toBe(204);
  });
});

// ─── POST /apple ──────────────────────────────────────────────────────────────

describe('POST /apple', () => {
  it('creates new user and returns 200 with tokens', async () => {
    vi.mocked(appleSignin.verifyIdToken).mockResolvedValueOnce({
      sub: 'apple-uid-123',
      email: 'apple@example.com',
      iss: '',
      aud: '',
      exp: 0,
      iat: 0,
    });

    const res = await request(app)
      .post('/apple')
      .send({ identity_token: 'valid.apple.token', name: 'Apple User' });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('apple@example.com');
    expect(typeof res.body.access_token).toBe('string');
  });

  it('logs in existing Apple user without requiring name', async () => {
    vi.mocked(appleSignin.verifyIdToken).mockResolvedValueOnce({
      sub: 'apple-uid-123',
      email: 'apple@example.com',
      iss: '',
      aud: '',
      exp: 0,
      iat: 0,
    });

    await request(app)
      .post('/apple')
      .send({ identity_token: 'valid.apple.token', name: 'Apple User' });

    vi.mocked(appleSignin.verifyIdToken).mockResolvedValueOnce({
      sub: 'apple-uid-123',
      iss: '',
      aud: '',
      exp: 0,
      iat: 0,
    });

    const res = await request(app)
      .post('/apple')
      .send({ identity_token: 'valid.apple.token' });

    expect(res.status).toBe(200);
  });

  it('returns 400 without identity_token', async () => {
    const res = await request(app).post('/apple').send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 when verifyIdToken throws', async () => {
    vi.mocked(appleSignin.verifyIdToken).mockRejectedValueOnce(new Error('invalid token'));

    const res = await request(app)
      .post('/apple')
      .send({ identity_token: 'bad.token', name: 'Apple User' });

    expect(res.status).toBe(401);
  });
});
