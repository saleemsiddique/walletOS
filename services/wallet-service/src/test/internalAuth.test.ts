import request from 'supertest';
import { createApp } from '../app';
import { Router } from 'express';
import { internalAuth } from '../middleware/internalAuth';

const INTERNAL_SECRET = process.env['INTERNAL_SECRET'] ?? 'test-internal-secret-minimum-32-chars!!';

function buildApp() {
  const app = createApp();
  const testRouter = Router();
  testRouter.get('/test-internal', internalAuth, (_req, res) => {
    res.json({ ok: true });
  });
  app.use(testRouter);
  return app;
}

describe('internalAuth middleware', () => {
  it('401 without X-Internal-Secret', async () => {
    const res = await request(buildApp()).get('/test-internal');
    expect(res.status).toBe(401);
  });

  it('401 with incorrect secret', async () => {
    const res = await request(buildApp()).get('/test-internal').set('X-Internal-Secret', 'wrong');
    expect(res.status).toBe(401);
  });

  it('passes with correct secret', async () => {
    const res = await request(buildApp())
      .get('/test-internal')
      .set('X-Internal-Secret', INTERNAL_SECRET);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
