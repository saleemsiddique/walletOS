import { vi } from 'vitest';

vi.mock('../lib/rabbitmq', () => ({
  connectRabbitMQ: vi.fn(),
  publishEvent: vi.fn(),
}));

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { getRedis } from '../lib/redis';
import { seedCategories } from '../lib/seed';

const INTERNAL_SECRET =
  process.env['INTERNAL_SECRET'] ?? 'test-internal-secret-minimum-32-chars!!';

const USER_A = 'a0000000-0000-0000-0000-000000000001';
const USER_B = 'b0000000-0000-0000-0000-000000000002';

type TxItem = {
  id: string;
  wallet_name: string;
  bank_name: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: { id: string; name: string; icon: string; type: string } | null;
  date: string;
  transfer_id: string | null;
};

async function makeBankAndWallet(userId: string) {
  const bank = await prisma.bank.create({ data: { user_id: userId, name: 'Santander' } });
  const wallet = await prisma.wallet.create({
    data: { user_id: userId, bank_id: bank.id, name: 'Nómina' },
  });
  return wallet;
}

describe('GET /internal/transactions', () => {
  it('401 without X-Internal-Secret', async () => {
    const res = await request(createApp()).get(
      `/internal/transactions?user_id=${USER_A}&from=2026-04-01&to=2026-04-30`,
    );
    expect(res.status).toBe(401);
  });

  it('401 with wrong X-Internal-Secret', async () => {
    const res = await request(createApp())
      .get(`/internal/transactions?user_id=${USER_A}&from=2026-04-01&to=2026-04-30`)
      .set('X-Internal-Secret', 'wrong');
    expect(res.status).toBe(401);
  });

  it('400 without required query params', async () => {
    const res = await request(createApp())
      .get('/internal/transactions')
      .set('X-Internal-Secret', INTERNAL_SECRET);
    expect(res.status).toBe(400);
  });

  it('200 returns transactions of user in date range', async () => {
    const wallet = await makeBankAndWallet(USER_A);
    await prisma.transaction.createMany({
      data: [
        {
          user_id: USER_A,
          wallet_id: wallet.id,
          type: 'EXPENSE',
          amount: '42.30',
          date: new Date('2026-04-18'),
        },
        {
          user_id: USER_A,
          wallet_id: wallet.id,
          type: 'EXPENSE',
          amount: '999.99',
          date: new Date('2026-05-15'), // outside range
        },
      ],
    });

    const res = await request(createApp())
      .get(`/internal/transactions?user_id=${USER_A}&from=2026-04-01&to=2026-04-30`)
      .set('X-Internal-Secret', INTERNAL_SECRET);

    expect(res.status).toBe(200);
    const body = res.body as { transactions: TxItem[] };
    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0]).toMatchObject({
      wallet_name: 'Nómina',
      bank_name: 'Santander',
      type: 'EXPENSE',
      amount: 42.3,
      date: '2026-04-18',
    });
  });

  it('excludes transfers', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'Santander' } });
    const w1 = await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'A' },
    });
    const w2 = await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'B' },
    });
    const transferId = '99999999-9999-9999-9999-999999999999';
    await prisma.transaction.createMany({
      data: [
        {
          user_id: USER_A,
          wallet_id: w1.id,
          type: 'EXPENSE',
          amount: '50.00',
          date: new Date('2026-04-05'),
          transfer_id: transferId,
        },
        {
          user_id: USER_A,
          wallet_id: w2.id,
          type: 'INCOME',
          amount: '50.00',
          date: new Date('2026-04-05'),
          transfer_id: transferId,
        },
        {
          user_id: USER_A,
          wallet_id: w1.id,
          type: 'EXPENSE',
          amount: '10.00',
          date: new Date('2026-04-06'),
        },
      ],
    });

    const res = await request(createApp())
      .get(`/internal/transactions?user_id=${USER_A}&from=2026-04-01&to=2026-04-30`)
      .set('X-Internal-Secret', INTERNAL_SECRET);
    const body = res.body as { transactions: TxItem[] };

    expect(body.transactions).toHaveLength(1);
    expect(body.transactions[0]?.amount).toBe(10);
  });

  it('does not include transactions of other users', async () => {
    const walletB = await makeBankAndWallet(USER_B);
    await prisma.transaction.create({
      data: {
        user_id: USER_B,
        wallet_id: walletB.id,
        type: 'EXPENSE',
        amount: '99.00',
        date: new Date('2026-04-10'),
      },
    });

    const res = await request(createApp())
      .get(`/internal/transactions?user_id=${USER_A}&from=2026-04-01&to=2026-04-30`)
      .set('X-Internal-Secret', INTERNAL_SECRET);
    const body = res.body as { transactions: TxItem[] };

    expect(body.transactions).toHaveLength(0);
  });
});

describe('GET /internal/categories', () => {
  type CategoryItem = { id: string; name: string; icon: string; type: 'INCOME' | 'EXPENSE' };
  type CategoriesBody = { categories: CategoryItem[] };

  beforeEach(async () => {
    await seedCategories();
    await getRedis().del(`internal:categories:${USER_A}`);
  });

  it('401 without X-Internal-Secret', async () => {
    const res = await request(createApp()).get(`/internal/categories?user_id=${USER_A}`);
    expect(res.status).toBe(401);
  });

  it('200 returns predefined + custom of user', async () => {
    await prisma.category.create({
      data: { user_id: USER_A, name: 'Gimnasio', icon: '💪', type: 'EXPENSE' },
    });

    const res = await request(createApp())
      .get(`/internal/categories?user_id=${USER_A}`)
      .set('X-Internal-Secret', INTERNAL_SECRET);

    expect(res.status).toBe(200);
    const body = res.body as CategoriesBody;
    expect(body.categories).toHaveLength(15);
    expect(body.categories.some((c) => c.name === 'Gimnasio')).toBe(true);
    expect(body.categories.some((c) => c.name === 'Comida')).toBe(true);
  });

  it('caches result in Redis after first call', async () => {
    const res1 = await request(createApp())
      .get(`/internal/categories?user_id=${USER_A}`)
      .set('X-Internal-Secret', INTERNAL_SECRET);
    expect(res1.status).toBe(200);

    const cached = await getRedis().get(`internal:categories:${USER_A}`);
    expect(cached).not.toBeNull();
    const parsed = JSON.parse(cached as string) as CategoriesBody;
    expect(parsed.categories).toHaveLength(14);
  });

  it('serves cached value on second call (DB changes do not appear until invalidation)', async () => {
    // First call populates cache with 14 predefined.
    await request(createApp())
      .get(`/internal/categories?user_id=${USER_A}`)
      .set('X-Internal-Secret', INTERNAL_SECRET);

    // Insert a new custom category directly in DB (bypassing the API → no invalidation).
    await prisma.category.create({
      data: { user_id: USER_A, name: 'NoCache', icon: '👻', type: 'EXPENSE' },
    });

    const res = await request(createApp())
      .get(`/internal/categories?user_id=${USER_A}`)
      .set('X-Internal-Secret', INTERNAL_SECRET);
    const body = res.body as CategoriesBody;

    expect(body.categories).toHaveLength(14);
    expect(body.categories.some((c) => c.name === 'NoCache')).toBe(false);
  });

  it('cache is invalidated when user creates a category via API', async () => {
    // Prime cache.
    await request(createApp())
      .get(`/internal/categories?user_id=${USER_A}`)
      .set('X-Internal-Secret', INTERNAL_SECRET);
    expect(await getRedis().get(`internal:categories:${USER_A}`)).not.toBeNull();

    const jwtSecret = process.env['JWT_SECRET'] ?? 'test-jwt-secret-minimum-32-characters-long!!';
    const token = jwt.sign({ userId: USER_A }, jwtSecret, {
      algorithm: 'HS256',
      expiresIn: '15m',
    });
    await request(createApp())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nueva', icon: '✨', type: 'EXPENSE' });

    expect(await getRedis().get(`internal:categories:${USER_A}`)).toBeNull();

    const res = await request(createApp())
      .get(`/internal/categories?user_id=${USER_A}`)
      .set('X-Internal-Secret', INTERNAL_SECRET);
    const body = res.body as CategoriesBody;
    expect(body.categories.some((c) => c.name === 'Nueva')).toBe(true);
  });
});
