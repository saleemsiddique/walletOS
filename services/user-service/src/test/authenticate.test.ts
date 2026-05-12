import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { authenticate } from '../middleware/authenticate';
import { errorHandler } from '../middleware/errorHandler';
import { signAccessToken } from '../lib/jwt';

function buildTestApp() {
  const app = express();
  app.get('/protected', authenticate, (req, res) => {
    res.json({ userId: req.userId });
  });
  app.use(errorHandler);
  return app;
}

describe('authenticate middleware', () => {
  const app = buildTestApp();

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed token', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer not.a.valid.token');
    expect(res.status).toBe(401);
  });

  it('populates req.userId and passes through with a valid token', async () => {
    const token = signAccessToken({ userId: 'user-abc' });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('user-abc');
  });
});
