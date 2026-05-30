import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-minimum-32-characters-long!!';

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
}

type WalletItem = {
  id: string;
  bank_id: string;
  name: string;
  icon: string;
  color: string;
  balance: number;
  is_archived: boolean;
};

const USER_A = 'a0000000-0000-0000-0000-000000000001';
const USER_B = 'b0000000-0000-0000-0000-000000000002';
const VALID_UUID = '00000000-0000-0000-0000-000000000abc';

describe('POST /banks/:id/wallets', () => {
  it('401 without token', async () => {
    const res = await request(createApp())
      .post(`/banks/${VALID_UUID}/wallets`)
      .send({ name: 'Ahorro' });
    expect(res.status).toBe(401);
  });

  it('201 creates wallet with initial_balance and balance equals initial_balance', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'Santander' } });

    const res = await request(createApp())
      .post(`/banks/${bank.id}/wallets`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'Ahorro', initial_balance: 1200, icon: '💰', color: '#34C759' });

    expect(res.status).toBe(201);
    const body = res.body as WalletItem;
    expect(body).toMatchObject({
      bank_id: bank.id,
      name: 'Ahorro',
      icon: '💰',
      color: '#34C759',
      balance: 1200,
      is_archived: false,
    });
  });

  it('201 applies defaults icon=💳 color=#007AFF initial_balance=0 when omitted', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'BBVA' } });

    const res = await request(createApp())
      .post(`/banks/${bank.id}/wallets`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'Cuenta' });

    expect(res.status).toBe(201);
    const body = res.body as WalletItem;
    expect(body).toMatchObject({ name: 'Cuenta', icon: '💳', color: '#007AFF', balance: 0 });
  });

  it('404 with non-existing bank_id', async () => {
    const res = await request(createApp())
      .post(`/banks/${VALID_UUID}/wallets`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'X' });

    expect(res.status).toBe(404);
  });

  it('404 with bank of another user', async () => {
    const otro = await prisma.bank.create({ data: { user_id: USER_B, name: 'OtroBanco' } });

    const res = await request(createApp())
      .post(`/banks/${otro.id}/wallets`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'Robado' });

    expect(res.status).toBe(404);
  });
});
