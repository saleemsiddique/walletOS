import { vi } from 'vitest';

vi.mock('../lib/rabbitmq', () => ({
  connectRabbitMQ: vi.fn(),
  publishEvent: vi.fn(),
}));

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-minimum-32-characters-long!!';

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
}

type RecurringItem = {
  id: string;
  wallet_id: string;
  wallet_name: string;
  bank_name: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: { id: string; name: string; icon: string } | null;
  note: string | null;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  day_of_month: number | null;
  day_of_week: number | null;
  next_run: string;
  is_active: boolean;
};

type ListBody = { recurring: RecurringItem[] };

const USER_A = 'a0000000-0000-0000-0000-000000000001';
const USER_B = 'b0000000-0000-0000-0000-000000000002';

async function makeWallet(userId: string): Promise<string> {
  const bank = await prisma.bank.create({ data: { user_id: userId, name: 'Santander' } });
  const wallet = await prisma.wallet.create({
    data: { user_id: userId, bank_id: bank.id, name: 'Nómina' },
  });
  return wallet.id;
}

describe('GET /recurring', () => {
  it('401 without token', async () => {
    const res = await request(createApp()).get('/recurring');
    expect(res.status).toBe(401);
  });

  it('200 lists only active rules of authenticated user', async () => {
    const walletId = await makeWallet(USER_A);
    await prisma.recurringRule.create({
      data: {
        user_id: USER_A,
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: '9.99',
        frequency: 'MONTHLY',
        day_of_month: 15,
        starts_at: new Date('2026-04-15'),
        next_run: new Date('2026-05-15'),
        note: 'Spotify',
      },
    });
    await prisma.recurringRule.create({
      data: {
        user_id: USER_A,
        wallet_id: walletId,
        type: 'INCOME',
        amount: '1500.00',
        frequency: 'MONTHLY',
        day_of_month: 1,
        starts_at: new Date('2026-04-01'),
        next_run: new Date('2026-05-01'),
        is_active: false,
      },
    });

    const res = await request(createApp())
      .get('/recurring')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    expect(res.status).toBe(200);
    expect(body.recurring).toHaveLength(1);
    expect(body.recurring[0]).toMatchObject({
      type: 'EXPENSE',
      amount: 9.99,
      note: 'Spotify',
      frequency: 'MONTHLY',
      day_of_month: 15,
      day_of_week: null,
      next_run: '2026-05-15',
      is_active: true,
      wallet_name: 'Nómina',
      bank_name: 'Santander',
    });
  });

  it('does not include rules of other users', async () => {
    const walletA = await makeWallet(USER_A);
    const walletB = await makeWallet(USER_B);
    await prisma.recurringRule.create({
      data: {
        user_id: USER_B,
        wallet_id: walletB,
        type: 'EXPENSE',
        amount: '1.00',
        frequency: 'DAILY',
        starts_at: new Date('2026-05-01'),
        next_run: new Date('2026-05-01'),
      },
    });
    expect(walletA).toBeTruthy();

    const res = await request(createApp())
      .get('/recurring')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    expect(body.recurring).toHaveLength(0);
  });
});
