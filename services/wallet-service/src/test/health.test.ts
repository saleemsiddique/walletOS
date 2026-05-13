import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

describe('GET /health', () => {
  it('returns 200 with correct body', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'wallet-service' });
  });

  it('returns 200 without Authorization header', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});
