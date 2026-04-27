import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';

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

const app = createApp();
const INTERNAL_SECRET = 'test-internal-secret-minimum-32-chars!!';

function internalHeader() {
  return { 'X-Internal-Secret': INTERNAL_SECRET };
}

async function registerUser(email: string, timezone = 'UTC', reminder_enabled = true) {
  const res = await request(app)
    .post('/register')
    .send({ email, password: 'password123', name: 'Internal User' });
  const body = res.body as { user: { id: string }; access_token: string };
  if (timezone !== 'UTC' || !reminder_enabled) {
    await prisma.user.update({
      where: { id: body.user.id },
      data: { timezone, reminder_enabled },
    });
  }
  return body.user;
}

// ─── GET /internal/users/:id ─────────────────────────────────────────────────

describe('GET /internal/users/:id', () => {
  it('returns 200 with all fields except created_at', async () => {
    const user = await registerUser('getbyid@example.com');

    const res = await request(app)
      .get(`/internal/users/${user.id}`)
      .set(internalHeader());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.email).toBe('getbyid@example.com');
    expect(res.body.name).toBe('Internal User');
    expect(typeof res.body.timezone).toBe('string');
    expect(typeof res.body.default_currency).toBe('string');
    expect(typeof res.body.has_password).toBe('boolean');
    expect(typeof res.body.apple_linked).toBe('boolean');
    expect(typeof res.body.google_linked).toBe('boolean');
    expect(typeof res.body.reminder_enabled).toBe('boolean');
    expect(typeof res.body.high_spend_enabled).toBe('boolean');
    expect(typeof res.body.high_spend_threshold).toBe('number');
    expect(res.body.created_at).toBeUndefined();
    expect(res.body.password_hash).toBeUndefined();
  });

  it('returns 404 for non-existent UUID', async () => {
    const res = await request(app)
      .get('/internal/users/00000000-0000-0000-0000-000000000000')
      .set(internalHeader());

    expect(res.status).toBe(404);
  });

  it('returns 401 without X-Internal-Secret', async () => {
    const res = await request(app).get('/internal/users/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
  });

  it('returns 401 with incorrect secret', async () => {
    const res = await request(app)
      .get('/internal/users/00000000-0000-0000-0000-000000000000')
      .set({ 'X-Internal-Secret': 'wrong-secret' });

    expect(res.status).toBe(401);
  });
});

// ─── GET /internal/users ─────────────────────────────────────────────────────

describe('GET /internal/users', () => {
  it('returns 200 with all users and correct total', async () => {
    const before = await prisma.user.count();
    await registerUser('list1@example.com');
    await registerUser('list2@example.com');

    const res = await request(app).get('/internal/users').set(internalHeader());

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(before + 2);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users).toHaveLength(before + 2);
  });

  it('returns only users with reminder_enabled=true', async () => {
    await registerUser('reminder-on@example.com', 'UTC', true);
    await registerUser('reminder-off@example.com', 'UTC', false);

    const res = await request(app)
      .get('/internal/users?reminder_enabled=true')
      .set(internalHeader());

    expect(res.status).toBe(200);
    const users1 = res.body.users as Array<{ reminder_enabled: boolean }>;
    expect(users1.every((u) => u.reminder_enabled)).toBe(true);
  });

  it('returns only users with matching timezone', async () => {
    await registerUser('tz-madrid@example.com', 'Europe/Madrid');
    await registerUser('tz-london@example.com', 'Europe/London');

    const res = await request(app)
      .get('/internal/users?timezone=Europe%2FMadrid')
      .set(internalHeader());

    expect(res.status).toBe(200);
    const users2 = res.body.users as Array<{ timezone: string }>;
    expect(users2.every((u) => u.timezone === 'Europe/Madrid')).toBe(true);
    expect(users2.length).toBeGreaterThanOrEqual(1);
  });

  it('filters by both timezone and reminder_enabled', async () => {
    await registerUser('both-on@example.com', 'Asia/Tokyo', true);
    await registerUser('both-off@example.com', 'Asia/Tokyo', false);

    const res = await request(app)
      .get('/internal/users?timezone=Asia%2FTokyo&reminder_enabled=true')
      .set(internalHeader());

    expect(res.status).toBe(200);
    const users3 = res.body.users as Array<{ timezone: string; reminder_enabled: boolean }>;
    expect(users3.every((u) => u.timezone === 'Asia/Tokyo' && u.reminder_enabled)).toBe(true);
  });

  it('returns 401 without X-Internal-Secret', async () => {
    const res = await request(app).get('/internal/users');
    expect(res.status).toBe(401);
  });

  it('returns 401 with incorrect secret', async () => {
    const res = await request(app)
      .get('/internal/users')
      .set({ 'X-Internal-Secret': 'wrong-secret' });

    expect(res.status).toBe(401);
  });
});
