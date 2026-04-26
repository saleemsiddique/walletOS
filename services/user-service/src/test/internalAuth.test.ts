import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { internalAuth } from '../middleware/internalAuth';
import { errorHandler } from '../middleware/errorHandler';

function buildTestApp() {
  const app = express();
  app.get('/internal/test', internalAuth, (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('internalAuth middleware', () => {
  const app = buildTestApp();
  const correctSecret = process.env['INTERNAL_SECRET'] ?? 'test-internal-secret-minimum-32-chars!!';

  it('returns 401 when X-Internal-Secret header is missing', async () => {
    const res = await request(app).get('/internal/test');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when X-Internal-Secret is incorrect', async () => {
    const res = await request(app)
      .get('/internal/test')
      .set('X-Internal-Secret', 'wrong-secret');
    expect(res.status).toBe(401);
  });

  it('passes through when X-Internal-Secret is correct', async () => {
    const res = await request(app)
      .get('/internal/test')
      .set('X-Internal-Secret', correctSecret);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
