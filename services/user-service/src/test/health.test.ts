import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

describe('GET /health', () => {
  it('returns 200 with correct body', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'user-service' });
  });

  it('returns 200 without auth credentials', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
  });

  it('returns JSON content type', async () => {
    const res = await request(app).get('/health');

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('App initialization', () => {
  it('creates app without throwing with complete test env vars', () => {
    expect(() => createApp()).not.toThrow();
  });
});
