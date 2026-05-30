import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-minimum-32-characters-long!!';

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
}

type BankItem = {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

const USER_A = 'a0000000-0000-0000-0000-000000000001';

describe('POST /banks', () => {
  it('401 without token', async () => {
    const res = await request(createApp()).post('/banks').send({ name: 'Santander' });
    expect(res.status).toBe(401);
  });

  it('201 creates bank with provided icon and color', async () => {
    const res = await request(createApp())
      .post('/banks')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'Santander', icon: '🏦', color: '#E31837' });

    expect(res.status).toBe(201);
    const body = res.body as BankItem;
    expect(body).toMatchObject({
      name: 'Santander',
      icon: '🏦',
      color: '#E31837',
      is_archived: false,
    });
    expect(typeof body.id).toBe('string');
  });

  it('201 applies defaults icon=🏦 color=#007AFF when omitted', async () => {
    const res = await request(createApp())
      .post('/banks')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'BBVA' });

    expect(res.status).toBe(201);
    const body = res.body as BankItem;
    expect(body).toMatchObject({ name: 'BBVA', icon: '🏦', color: '#007AFF' });
  });

  it('400 with invalid body (missing name)', async () => {
    const res = await request(createApp())
      .post('/banks')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ icon: '🏦' });

    expect(res.status).toBe(400);
  });
});
