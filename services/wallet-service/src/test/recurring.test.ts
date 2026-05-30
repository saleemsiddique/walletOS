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

describe('POST /recurring', () => {
  beforeEach(async () => {
    const { seedCategories } = await import('../lib/seed');
    await seedCategories();
  });

  it('401 without token', async () => {
    const res = await request(createApp())
      .post('/recurring')
      .send({ wallet_id: 'x', type: 'EXPENSE', amount: 1, frequency: 'DAILY' });
    expect(res.status).toBe(401);
  });

  it('201 creates MONTHLY rule with day_of_month and computes next_run', async () => {
    const walletId = await makeWallet(USER_A);
    const cat = await prisma.category.findFirstOrThrow({
      where: { user_id: null, name: 'Suscripciones', type: 'EXPENSE' },
    });

    const res = await request(createApp())
      .post('/recurring')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: 9.99,
        category_id: cat.id,
        note: 'Spotify',
        frequency: 'MONTHLY',
        day_of_month: 15,
        starts_at: '2026-04-20',
      });

    expect(res.status).toBe(201);
    const body = res.body as RecurringItem;
    expect(body).toMatchObject({
      type: 'EXPENSE',
      amount: 9.99,
      note: 'Spotify',
      frequency: 'MONTHLY',
      day_of_month: 15,
      day_of_week: null,
      next_run: '2026-05-15',
      is_active: true,
    });
  });

  it('201 creates WEEKLY rule with day_of_week (0=Monday)', async () => {
    const walletId = await makeWallet(USER_A);

    const res = await request(createApp())
      .post('/recurring')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: 5,
        frequency: 'WEEKLY',
        day_of_week: 0,
        starts_at: '2026-05-12', // Tuesday
      });

    expect(res.status).toBe(201);
    expect((res.body as RecurringItem).next_run).toBe('2026-05-18');
  });

  it('201 creates DAILY rule and next_run = starts_at', async () => {
    const walletId = await makeWallet(USER_A);

    const res = await request(createApp())
      .post('/recurring')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: 1,
        frequency: 'DAILY',
        starts_at: '2026-05-10',
      });

    expect(res.status).toBe(201);
    expect((res.body as RecurringItem).next_run).toBe('2026-05-10');
  });

  it('400 when MONTHLY without day_of_month', async () => {
    const walletId = await makeWallet(USER_A);

    const res = await request(createApp())
      .post('/recurring')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ wallet_id: walletId, type: 'EXPENSE', amount: 1, frequency: 'MONTHLY' });

    expect(res.status).toBe(400);
  });

  it('400 when WEEKLY without day_of_week', async () => {
    const walletId = await makeWallet(USER_A);

    const res = await request(createApp())
      .post('/recurring')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ wallet_id: walletId, type: 'EXPENSE', amount: 1, frequency: 'WEEKLY' });

    expect(res.status).toBe(400);
  });

  it('400 when category_id belongs to another user', async () => {
    const walletId = await makeWallet(USER_A);
    const otherCat = await prisma.category.create({
      data: { user_id: USER_B, name: 'PrivadaB', icon: '🔒', type: 'EXPENSE' },
    });

    const res = await request(createApp())
      .post('/recurring')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: 1,
        frequency: 'DAILY',
        category_id: otherCat.id,
      });

    expect(res.status).toBe(400);
  });

  it('404 when wallet_id does not exist', async () => {
    const res = await request(createApp())
      .post('/recurring')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({
        wallet_id: '00000000-0000-0000-0000-000000000abc',
        type: 'EXPENSE',
        amount: 1,
        frequency: 'DAILY',
      });

    expect(res.status).toBe(404);
  });

  it('404 when wallet_id belongs to another user', async () => {
    const foreignWallet = await makeWallet(USER_B);

    const res = await request(createApp())
      .post('/recurring')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({
        wallet_id: foreignWallet,
        type: 'EXPENSE',
        amount: 1,
        frequency: 'DAILY',
      });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /recurring/:id', () => {
  const VALID_UUID = '00000000-0000-0000-0000-000000000abc';

  it('401 without token', async () => {
    const res = await request(createApp())
      .patch(`/recurring/${VALID_UUID}`)
      .send({ amount: 5 });
    expect(res.status).toBe(401);
  });

  it('200 updates amount, note, is_active', async () => {
    const walletId = await makeWallet(USER_A);
    const rule = await prisma.recurringRule.create({
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

    const res = await request(createApp())
      .patch(`/recurring/${rule.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ amount: 12.99, note: 'Spotify Premium', is_active: false });

    expect(res.status).toBe(200);
    const body = res.body as RecurringItem;
    expect(body).toMatchObject({
      id: rule.id,
      amount: 12.99,
      note: 'Spotify Premium',
      is_active: false,
    });
  });

  it('404 with rule of another user', async () => {
    const walletId = await makeWallet(USER_B);
    const rule = await prisma.recurringRule.create({
      data: {
        user_id: USER_B,
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: '1.00',
        frequency: 'DAILY',
        starts_at: new Date('2026-05-01'),
        next_run: new Date('2026-05-01'),
      },
    });

    const res = await request(createApp())
      .patch(`/recurring/${rule.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ amount: 5 });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /recurring/:id', () => {
  const VALID_UUID = '00000000-0000-0000-0000-000000000abc';

  it('401 without token', async () => {
    const res = await request(createApp()).delete(`/recurring/${VALID_UUID}`);
    expect(res.status).toBe(401);
  });

  it('204 deletes own rule', async () => {
    const walletId = await makeWallet(USER_A);
    const rule = await prisma.recurringRule.create({
      data: {
        user_id: USER_A,
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: '1.00',
        frequency: 'DAILY',
        starts_at: new Date('2026-05-01'),
        next_run: new Date('2026-05-01'),
      },
    });

    const res = await request(createApp())
      .delete(`/recurring/${rule.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(204);
    const db = await prisma.recurringRule.findUnique({ where: { id: rule.id } });
    expect(db).toBeNull();
  });

  it('404 with non-existing id', async () => {
    const res = await request(createApp())
      .delete(`/recurring/${VALID_UUID}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(404);
  });
});
