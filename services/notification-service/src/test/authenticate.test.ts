import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-minimum-32-characters-long!!';

function buildApp() {
  const app = createApp();
  const testRouter = Router();
  testRouter.get('/test-auth', authenticate, (req, res) => {
    res.json({ userId: req.userId });
  });
  app.use(testRouter);
  return app;
}

describe('authenticate middleware', () => {
  it('401 without Authorization header', async () => {
    const res = await request(buildApp()).get('/test-auth');
    expect(res.status).toBe(401);
  });

  it('401 with malformed token', async () => {
    const res = await request(buildApp()).get('/test-auth').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });

  it('401 with wrong signing secret', async () => {
    const token = jwt.sign({ userId: 'abc' }, 'wrong-secret', { algorithm: 'HS256' });
    const res = await request(buildApp()).get('/test-auth').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('populates req.userId with valid token', async () => {
    const userId = 'c0000000-0000-0000-0000-000000000001';
    const token = jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
    const res = await request(buildApp()).get('/test-auth').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(userId);
  });
});
