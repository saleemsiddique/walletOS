import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { hashToken, generateOpaqueToken } from '../lib/token';

vi.mock('../lib/email', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

import { sendPasswordResetEmail } from '../lib/email';

const app = createApp();

async function createUser(email = 'reset@example.com') {
  return request(app)
    .post('/register')
    .send({ email, password: 'password123', name: 'Reset User' });
}

// ─── POST /auth/forgot-password ───────────────────────────────────────────────

describe('POST /auth/forgot-password', () => {
  beforeEach(() => {
    vi.mocked(sendPasswordResetEmail).mockClear();
  });

  it('returns 204 with existing email', async () => {
    await createUser();
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'reset@example.com' });

    expect(res.status).toBe(204);
  });

  it('returns 204 with non-existent email (no info leakage)', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(204);
  });

  it('stores token hash in DB', async () => {
    await createUser();
    await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'reset@example.com' });

    const records = await prisma.passwordResetToken.findMany();
    expect(records).toHaveLength(1);
    expect(records[0]!.token_hash).toHaveLength(64);
  });

  it('sets expires_at to approximately now + 1h', async () => {
    await createUser();
    const before = Date.now();

    await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'reset@example.com' });

    const record = await prisma.passwordResetToken.findFirst();
    const expiresMs = record!.expires_at.getTime();
    const expectedMs = before + 60 * 60 * 1000;

    expect(expiresMs).toBeGreaterThanOrEqual(expectedMs - 5000);
    expect(expiresMs).toBeLessThanOrEqual(expectedMs + 5000);
  });

  it('calls sendPasswordResetEmail with the correct email', async () => {
    await createUser();
    await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'reset@example.com' });

    expect(sendPasswordResetEmail).toHaveBeenCalledOnce();
    expect(vi.mocked(sendPasswordResetEmail).mock.calls[0]![0]).toBe('reset@example.com');
  });

  it('calls sendPasswordResetEmail with a plain token that hashes to the stored hash', async () => {
    await createUser();
    await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'reset@example.com' });

    const plainToken = vi.mocked(sendPasswordResetEmail).mock.calls[0]![1];
    const record = await prisma.passwordResetToken.findFirst();
    expect(hashToken(plainToken)).toBe(record!.token_hash);
  });

  it('does not call sendPasswordResetEmail for non-existent email', async () => {
    await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'nobody@example.com' });

    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('returns 400 with invalid email format', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
  });
});

// ─── POST /auth/reset-password ────────────────────────────────────────────────

describe('POST /auth/reset-password', () => {
  async function setupResetToken(email = 'reset@example.com') {
    await createUser(email);
    vi.mocked(sendPasswordResetEmail).mockClear();

    await request(app)
      .post('/auth/forgot-password')
      .send({ email });

    return vi.mocked(sendPasswordResetEmail).mock.calls[0]![1];
  }

  beforeEach(() => {
    vi.mocked(sendPasswordResetEmail).mockClear();
  });

  it('returns 204 and updates password_hash in DB', async () => {
    const token = await setupResetToken();
    const userBefore = await prisma.user.findUnique({ where: { email: 'reset@example.com' } });
    const oldHash = userBefore!.password_hash;

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token, new_password: 'newpassword123' });

    expect(res.status).toBe(204);

    const userAfter = await prisma.user.findUnique({ where: { email: 'reset@example.com' } });
    expect(userAfter!.password_hash).not.toBe(oldHash);
    expect(userAfter!.password_hash).not.toBeNull();
  });

  it('deletes all refresh tokens after reset', async () => {
    const token = await setupResetToken();
    const user = await prisma.user.findUnique({ where: { email: 'reset@example.com' } });

    await prisma.refreshToken.findMany({ where: { user_id: user!.id } });

    await request(app)
      .post('/auth/reset-password')
      .send({ token, new_password: 'newpassword123' });

    const remaining = await prisma.refreshToken.findMany({ where: { user_id: user!.id } });
    expect(remaining).toHaveLength(0);
  });

  it('marks used_at on the reset token', async () => {
    const token = await setupResetToken();

    await request(app)
      .post('/auth/reset-password')
      .send({ token, new_password: 'newpassword123' });

    const record = await prisma.passwordResetToken.findFirst();
    expect(record!.used_at).not.toBeNull();
  });

  it('returns 400 when token is already used', async () => {
    const token = await setupResetToken();

    await request(app)
      .post('/auth/reset-password')
      .send({ token, new_password: 'newpassword123' });

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token, new_password: 'anotherpassword' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when token is expired', async () => {
    const token = await setupResetToken();

    await prisma.passwordResetToken.updateMany({
      data: { expires_at: new Date(Date.now() - 1000) },
    });

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token, new_password: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 with non-existent token', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: generateOpaqueToken(), new_password: 'newpassword123' });

    expect(res.status).toBe(400);
  });

  it('returns 400 with new_password shorter than 8 characters', async () => {
    const token = await setupResetToken();

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token, new_password: 'short' });

    expect(res.status).toBe(400);
  });

  it('allows login with new password after reset', async () => {
    const token = await setupResetToken();

    await request(app)
      .post('/auth/reset-password')
      .send({ token, new_password: 'newpassword123' });

    const res = await request(app)
      .post('/login')
      .send({ email: 'reset@example.com', password: 'newpassword123' });

    expect(res.status).toBe(200);
    expect(typeof res.body.access_token).toBe('string');
  });

  it('rejects login with old password after reset', async () => {
    const token = await setupResetToken();

    await request(app)
      .post('/auth/reset-password')
      .send({ token, new_password: 'newpassword123' });

    const res = await request(app)
      .post('/login')
      .send({ email: 'reset@example.com', password: 'password123' });

    expect(res.status).toBe(401);
  });
});
