import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { signAccessToken } from '../lib/jwt';

vi.mock('../lib/rabbitmq', () => ({
  connectRabbitMQ: vi.fn().mockResolvedValue(undefined),
  publishEvent: vi.fn(),
}));

vi.mock('apple-signin-auth', () => ({
  default: { verifyIdToken: vi.fn() },
}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn(),
}));

import { publishEvent } from '../lib/rabbitmq';

const app = createApp();

async function registerUser(email = 'me@example.com') {
  const res = await request(app)
    .post('/register')
    .send({ email, password: 'password123', name: 'Me User' });
  return res.body as { user: { id: string }; access_token: string };
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ─── GET /me ─────────────────────────────────────────────────────────────────

describe('GET /me', () => {
  it('returns 200 with all fields including computed flags', async () => {
    const { user, access_token } = await registerUser();

    const res = await request(app).get('/me').set(authHeader(access_token));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.email).toBe('me@example.com');
    expect(res.body.name).toBe('Me User');
    expect(typeof res.body.timezone).toBe('string');
    expect(typeof res.body.default_currency).toBe('string');
    expect(typeof res.body.has_password).toBe('boolean');
    expect(typeof res.body.apple_linked).toBe('boolean');
    expect(typeof res.body.google_linked).toBe('boolean');
    expect(typeof res.body.reminder_enabled).toBe('boolean');
    expect(typeof res.body.high_spend_enabled).toBe('boolean');
    expect(typeof res.body.high_spend_threshold).toBe('number');
    expect(typeof res.body.created_at).toBe('string');
    expect(res.body.password_hash).toBeUndefined();
  });

  it('returns has_password false when user has no password (apple/google user)', async () => {
    const { user } = await registerUser('nopass@example.com');
    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash: null },
    });
    const token = signAccessToken({ userId: user.id });

    const res = await request(app).get('/me').set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.has_password).toBe(false);
  });

  it('returns apple_linked true when apple_id is set', async () => {
    const { user } = await registerUser('apple@example.com');
    await prisma.user.update({
      where: { id: user.id },
      data: { apple_id: 'apple-uid-test' },
    });
    const token = signAccessToken({ userId: user.id });

    const res = await request(app).get('/me').set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.apple_linked).toBe(true);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
  });
});

// ─── PATCH /me ────────────────────────────────────────────────────────────────

describe('PATCH /me', () => {
  it('returns 200 updating name', async () => {
    const { access_token } = await registerUser();

    const res = await request(app)
      .patch('/me')
      .set(authHeader(access_token))
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Name');
  });

  it('returns 200 updating timezone with valid IANA value', async () => {
    const { access_token } = await registerUser();

    const res = await request(app)
      .patch('/me')
      .set(authHeader(access_token))
      .send({ timezone: 'Europe/Madrid' });

    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe('Europe/Madrid');
  });

  it('returns 400 with invalid timezone', async () => {
    const { access_token } = await registerUser();

    const res = await request(app)
      .patch('/me')
      .set(authHeader(access_token))
      .send({ timezone: 'Fake/Zone' });

    expect(res.status).toBe(400);
  });

  it('returns 200 with empty body and returns current data unchanged', async () => {
    const { user, access_token } = await registerUser();

    const res = await request(app)
      .patch('/me')
      .set(authHeader(access_token))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.name).toBe('Me User');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).patch('/me').send({ name: 'Name' });
    expect(res.status).toBe(401);
  });
});

// ─── DELETE /me ───────────────────────────────────────────────────────────────

describe('DELETE /me', () => {
  it('returns 204 and removes user from DB', async () => {
    const { user, access_token } = await registerUser();

    const res = await request(app).delete('/me').set(authHeader(access_token));

    expect(res.status).toBe(204);

    const deleted = await prisma.user.findUnique({ where: { id: user.id } });
    expect(deleted).toBeNull();
  });

  it('cascades delete to refresh_tokens and password_reset_tokens', async () => {
    const { user, access_token } = await registerUser();

    await request(app).delete('/me').set(authHeader(access_token));

    const refreshTokens = await prisma.refreshToken.findMany({ where: { user_id: user.id } });
    const resetTokens = await prisma.passwordResetToken.findMany({ where: { user_id: user.id } });

    expect(refreshTokens).toHaveLength(0);
    expect(resetTokens).toHaveLength(0);
  });

  it('publishes user.deleted event to RabbitMQ', async () => {
    vi.mocked(publishEvent).mockClear();
    const { user, access_token } = await registerUser();

    await request(app).delete('/me').set(authHeader(access_token));

    expect(publishEvent).toHaveBeenCalledOnce();
    expect(vi.mocked(publishEvent).mock.calls[0]![0]).toBe('user.deleted');
    expect(vi.mocked(publishEvent).mock.calls[0]![1]).toEqual({ user_id: user.id });
  });

  it('returns 401 without token', async () => {
    const res = await request(app).delete('/me');
    expect(res.status).toBe(401);
  });
});
