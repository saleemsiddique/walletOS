import request from 'supertest';
import { createApp } from '../app';
import { Router } from 'express';
import { createRateLimiter } from '../middleware/rateLimiter';
import { getRedis } from '../lib/redis';

function buildApp(max: number, windowSeconds: number) {
  const app = createApp();
  const testRouter = Router();
  const limiter = createRateLimiter(max, windowSeconds, () => 'test-key');
  testRouter.get('/test-rl', limiter, (_req, res) => {
    res.json({ ok: true });
  });
  app.use(testRouter);
  return app;
}

describe('createRateLimiter', () => {
  afterEach(async () => {
    await getRedis().flushdb();
  });

  it('allows requests under the limit', async () => {
    const app = buildApp(3, 60);
    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/test-rl');
      expect(res.status).toBe(200);
    }
  });

  it('blocks the request that exceeds the limit', async () => {
    const app = buildApp(2, 60);
    await request(app).get('/test-rl');
    await request(app).get('/test-rl');
    const res = await request(app).get('/test-rl');
    expect(res.status).toBe(429);
  });
});
