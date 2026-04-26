import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { setTimeout as sleep } from 'timers/promises';
import express from 'express';
import request from 'supertest';
import { createRateLimiter } from '../middleware/rateLimiter';
import { errorHandler } from '../middleware/errorHandler';
import { getRedis } from '../lib/redis';

const TEST_KEY = 'test-ip-rl';
const TEST_ENDPOINT_KEY = `rl:${TEST_KEY}:GET:/limited`;

function buildTestApp(max: number, windowSeconds: number) {
  const app = express();
  const limiter = createRateLimiter(max, windowSeconds, () => TEST_KEY);
  app.get('/limited', limiter, (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('rateLimiter middleware', () => {
  beforeEach(async () => {
    await getRedis().del(TEST_ENDPOINT_KEY);
  });

  afterAll(async () => {
    await getRedis().del(TEST_ENDPOINT_KEY);
  });

  it('allows requests up to the limit', async () => {
    const app = buildTestApp(3, 60);

    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/limited');
      expect(res.status).toBe(200);
    }
  });

  it('returns 429 when limit is exceeded', async () => {
    const app = buildTestApp(2, 60);

    await request(app).get('/limited');
    await request(app).get('/limited');

    const res = await request(app).get('/limited');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('allows requests again after the window expires', async () => {
    const app = buildTestApp(1, 1); // 1 request per 1 second

    const first = await request(app).get('/limited');
    expect(first.status).toBe(200);

    const blocked = await request(app).get('/limited');
    expect(blocked.status).toBe(429);

    await sleep(1100);

    const afterExpiry = await request(app).get('/limited');
    expect(afterExpiry.status).toBe(200);
  });
});
