import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-minimum-32-characters-long!!';

const USER_A = 'a0000000-0000-0000-0000-000000000001';
const USER_B = 'b0000000-0000-0000-0000-000000000002';

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
}

type DeviceItem = {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  created_at: string;
};

describe('POST /devices', () => {
  it('401 without token', async () => {
    const res = await request(createApp()).post('/devices').send({ token: 'apns-abc' });
    expect(res.status).toBe(401);
  });

  it('201 creates device token', async () => {
    const res = await request(createApp())
      .post('/devices')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ token: 'apns-token-001' });

    expect(res.status).toBe(201);
    const body = res.body as DeviceItem;
    expect(body).toMatchObject({ token: 'apns-token-001', platform: 'ios', user_id: USER_A });
    expect(typeof body.id).toBe('string');
  });

  it('upsert: second call with same token does not duplicate', async () => {
    const app = createApp();
    const auth = `Bearer ${signToken(USER_A)}`;

    await request(app).post('/devices').set('Authorization', auth).send({ token: 'apns-token-dup' });
    await request(app).post('/devices').set('Authorization', auth).send({ token: 'apns-token-dup' });

    const count = await prisma.deviceToken.count({ where: { token: 'apns-token-dup' } });
    expect(count).toBe(1);
  });

  it('upsert: reassigns user_id when token belongs to another user', async () => {
    const app = createApp();

    await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ token: 'shared-token' });

    const res = await request(app)
      .post('/devices')
      .set('Authorization', `Bearer ${signToken(USER_B)}`)
      .send({ token: 'shared-token' });

    expect(res.status).toBe(201);
    const body = res.body as DeviceItem;
    expect(body.user_id).toBe(USER_B);

    const count = await prisma.deviceToken.count({ where: { token: 'shared-token' } });
    expect(count).toBe(1);
  });

  it('400 with missing token', async () => {
    const res = await request(createApp())
      .post('/devices')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('DELETE /devices/:token', () => {
  it('401 without token', async () => {
    const res = await request(createApp()).delete('/devices/some-apns-token');
    expect(res.status).toBe(401);
  });

  it('204 deletes an existing device token', async () => {
    await prisma.deviceToken.create({ data: { user_id: USER_A, token: 'to-delete' } });

    const res = await request(createApp())
      .delete('/devices/to-delete')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(204);
    const count = await prisma.deviceToken.count({ where: { token: 'to-delete' } });
    expect(count).toBe(0);
  });

  it('204 idempotent — no error when token does not exist', async () => {
    const res = await request(createApp())
      .delete('/devices/non-existent-token')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    expect(res.status).toBe(204);
  });
});
