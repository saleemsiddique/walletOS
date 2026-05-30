import { vi } from 'vitest';

vi.mock('../lib/rabbitmq', () => ({
  connectRabbitMQ: vi.fn(),
  publishEvent: vi.fn(),
}));

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { seedCategories } from '../lib/seed';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-minimum-32-characters-long!!';

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
}

type StatsBody = {
  period: { month: number; year: number };
  total_expense: number;
  total_income: number;
  previous_period: { total_expense: number; total_income: number };
  expense_change_pct: number;
  income_change_pct: number;
  by_category: {
    category_id: string | null;
    name: string;
    icon: string;
    total: number;
    pct: number;
    transaction_count: number;
  }[];
};

const USER_A = 'a0000000-0000-0000-0000-000000000001';
const USER_B = 'b0000000-0000-0000-0000-000000000002';

async function makeBankAndWallet(userId: string, walletName = 'Nómina') {
  const bank = await prisma.bank.create({ data: { user_id: userId, name: 'Santander' } });
  const wallet = await prisma.wallet.create({
    data: { user_id: userId, bank_id: bank.id, name: walletName },
  });
  return { bank, wallet };
}

describe('GET /stats', () => {
  beforeEach(async () => {
    await seedCategories();
  });

  it('401 without token', async () => {
    const res = await request(createApp()).get('/stats?month=4&year=2026');
    expect(res.status).toBe(401);
  });

  it('200 with totals, by_category and previous_period', async () => {
    const { wallet } = await makeBankAndWallet(USER_A);
    const comida = await prisma.category.findFirstOrThrow({
      where: { user_id: null, name: 'Comida', type: 'EXPENSE' },
    });
    const transporte = await prisma.category.findFirstOrThrow({
      where: { user_id: null, name: 'Transporte', type: 'EXPENSE' },
    });
    const nomina = await prisma.category.findFirstOrThrow({
      where: { user_id: null, name: 'Nómina', type: 'INCOME' },
    });

    await prisma.transaction.createMany({
      data: [
        // April 2026 — current period
        {
          user_id: USER_A,
          wallet_id: wallet.id,
          type: 'EXPENSE',
          amount: '300.00',
          date: new Date('2026-04-05'),
          category_id: comida.id,
        },
        {
          user_id: USER_A,
          wallet_id: wallet.id,
          type: 'EXPENSE',
          amount: '200.00',
          date: new Date('2026-04-10'),
          category_id: transporte.id,
        },
        {
          user_id: USER_A,
          wallet_id: wallet.id,
          type: 'INCOME',
          amount: '2000.00',
          date: new Date('2026-04-01'),
          category_id: nomina.id,
        },
        // March 2026 — previous period
        {
          user_id: USER_A,
          wallet_id: wallet.id,
          type: 'EXPENSE',
          amount: '400.00',
          date: new Date('2026-03-15'),
          category_id: comida.id,
        },
        {
          user_id: USER_A,
          wallet_id: wallet.id,
          type: 'INCOME',
          amount: '2000.00',
          date: new Date('2026-03-01'),
          category_id: nomina.id,
        },
      ],
    });

    const res = await request(createApp())
      .get('/stats?month=4&year=2026')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(200);
    const body = res.body as StatsBody;
    expect(body.period).toEqual({ month: 4, year: 2026 });
    expect(body.total_expense).toBe(500);
    expect(body.total_income).toBe(2000);
    expect(body.previous_period).toEqual({ total_expense: 400, total_income: 2000 });
    expect(body.expense_change_pct).toBe(25);
    expect(body.income_change_pct).toBe(0);
    expect(body.by_category).toHaveLength(2);
    expect(body.by_category[0]).toMatchObject({
      name: 'Comida',
      total: 300,
      pct: 60,
      transaction_count: 1,
    });
    expect(body.by_category[1]).toMatchObject({ name: 'Transporte', total: 200, pct: 40 });
  });

  it('excludes transfers from totals and by_category', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'Santander' } });
    const w1 = await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'Origen' },
    });
    const w2 = await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'Destino' },
    });
    const transferId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    await prisma.transaction.createMany({
      data: [
        {
          user_id: USER_A,
          wallet_id: w1.id,
          type: 'EXPENSE',
          amount: '500.00',
          date: new Date('2026-04-05'),
          transfer_id: transferId,
        },
        {
          user_id: USER_A,
          wallet_id: w2.id,
          type: 'INCOME',
          amount: '500.00',
          date: new Date('2026-04-05'),
          transfer_id: transferId,
        },
        {
          user_id: USER_A,
          wallet_id: w1.id,
          type: 'EXPENSE',
          amount: '50.00',
          date: new Date('2026-04-06'),
        },
      ],
    });

    const res = await request(createApp())
      .get('/stats?month=4&year=2026')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as StatsBody;

    expect(body.total_expense).toBe(50);
    expect(body.total_income).toBe(0);
  });

  it('filters by wallet_id', async () => {
    const { wallet: w1 } = await makeBankAndWallet(USER_A, 'W1');
    const bank2 = await prisma.bank.create({ data: { user_id: USER_A, name: 'BBVA' } });
    const w2 = await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank2.id, name: 'W2' },
    });
    await prisma.transaction.createMany({
      data: [
        {
          user_id: USER_A,
          wallet_id: w1.id,
          type: 'EXPENSE',
          amount: '100.00',
          date: new Date('2026-04-05'),
        },
        {
          user_id: USER_A,
          wallet_id: w2.id,
          type: 'EXPENSE',
          amount: '999.00',
          date: new Date('2026-04-05'),
        },
      ],
    });

    const res = await request(createApp())
      .get(`/stats?month=4&year=2026&wallet_id=${w1.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect((res.body as StatsBody).total_expense).toBe(100);
  });

  it('filters by bank_id (covers all wallets of that bank)', async () => {
    const { bank: b1, wallet: w1 } = await makeBankAndWallet(USER_A, 'W1');
    const b2 = await prisma.bank.create({ data: { user_id: USER_A, name: 'B2' } });
    const w2 = await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: b2.id, name: 'W2' },
    });
    await prisma.transaction.createMany({
      data: [
        {
          user_id: USER_A,
          wallet_id: w1.id,
          type: 'EXPENSE',
          amount: '100.00',
          date: new Date('2026-04-05'),
        },
        {
          user_id: USER_A,
          wallet_id: w2.id,
          type: 'EXPENSE',
          amount: '999.00',
          date: new Date('2026-04-05'),
        },
      ],
    });

    const res = await request(createApp())
      .get(`/stats?month=4&year=2026&bank_id=${b1.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect((res.body as StatsBody).total_expense).toBe(100);
  });

  it('400 with month out of range', async () => {
    const res = await request(createApp())
      .get('/stats?month=13&year=2026')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(400);
  });

  it('does not include transactions of other users', async () => {
    const { wallet } = await makeBankAndWallet(USER_B);
    await prisma.transaction.create({
      data: {
        user_id: USER_B,
        wallet_id: wallet.id,
        type: 'EXPENSE',
        amount: '999.00',
        date: new Date('2026-04-05'),
      },
    });

    const res = await request(createApp())
      .get('/stats?month=4&year=2026')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect((res.body as StatsBody).total_expense).toBe(0);
  });
});

describe('GET /stats/daily', () => {
  type DailyBody = { days: { date: string; expense: number; income: number }[] };

  it('401 without token', async () => {
    const res = await request(createApp()).get('/stats/daily?from=2026-04-01&to=2026-04-03');
    expect(res.status).toBe(401);
  });

  it('200 returns all days in range including empty ones', async () => {
    const { wallet } = await makeBankAndWallet(USER_A);
    await prisma.transaction.createMany({
      data: [
        {
          user_id: USER_A,
          wallet_id: wallet.id,
          type: 'EXPENSE',
          amount: '45.30',
          date: new Date('2026-04-01'),
        },
        {
          user_id: USER_A,
          wallet_id: wallet.id,
          type: 'INCOME',
          amount: '100.00',
          date: new Date('2026-04-03'),
        },
      ],
    });

    const res = await request(createApp())
      .get('/stats/daily?from=2026-04-01&to=2026-04-03')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as DailyBody;

    expect(res.status).toBe(200);
    expect(body.days).toEqual([
      { date: '2026-04-01', expense: 45.3, income: 0 },
      { date: '2026-04-02', expense: 0, income: 0 },
      { date: '2026-04-03', expense: 0, income: 100 },
    ]);
  });

  it('excludes transfers from totals', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'Santander' } });
    const w1 = await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'A' },
    });
    const w2 = await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'B' },
    });
    const transferId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
    await prisma.transaction.createMany({
      data: [
        {
          user_id: USER_A,
          wallet_id: w1.id,
          type: 'EXPENSE',
          amount: '50.00',
          date: new Date('2026-04-01'),
          transfer_id: transferId,
        },
        {
          user_id: USER_A,
          wallet_id: w2.id,
          type: 'INCOME',
          amount: '50.00',
          date: new Date('2026-04-01'),
          transfer_id: transferId,
        },
      ],
    });

    const res = await request(createApp())
      .get('/stats/daily?from=2026-04-01&to=2026-04-01')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as DailyBody;

    expect(body.days).toEqual([{ date: '2026-04-01', expense: 0, income: 0 }]);
  });

  it('400 when range exceeds 31 days', async () => {
    const res = await request(createApp())
      .get('/stats/daily?from=2026-04-01&to=2026-05-15')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(400);
  });

  it('400 when from > to', async () => {
    const res = await request(createApp())
      .get('/stats/daily?from=2026-04-10&to=2026-04-01')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(400);
  });
});

describe('GET /dashboard', () => {
  type RecentTx = {
    id: string;
    type: 'INCOME' | 'EXPENSE';
    amount: number;
    paired_wallet_name: string | null;
    transfer_id: string | null;
  };
  type DashboardBody = {
    total_balance: number;
    month_expense: number;
    month_expense_change_pct: number;
    recent_transactions: RecentTx[];
  };

  const now = new Date();
  const currentMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 5));
  const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));

  it('401 without token', async () => {
    const res = await request(createApp()).get('/dashboard');
    expect(res.status).toBe(401);
  });

  it('200 with total_balance, month_expense, change_pct and recent_transactions', async () => {
    const { wallet } = await makeBankAndWallet(USER_A);
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { initial_balance: '5000.00' },
    });
    await prisma.transaction.createMany({
      data: [
        {
          user_id: USER_A,
          wallet_id: wallet.id,
          type: 'EXPENSE',
          amount: '100.00',
          date: currentMonthDate,
        },
        {
          user_id: USER_A,
          wallet_id: wallet.id,
          type: 'EXPENSE',
          amount: '50.00',
          date: prevMonthDate,
        },
      ],
    });

    const res = await request(createApp())
      .get('/dashboard')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as DashboardBody;

    expect(res.status).toBe(200);
    expect(body.total_balance).toBe(4850); // 5000 initial − 100 current − 50 previous
    expect(body.month_expense).toBe(100);
    expect(body.month_expense_change_pct).toBe(100); // (100 − 50) / 50 * 100
    expect(body.recent_transactions).toHaveLength(2);
  });

  it('recent_transactions is capped at 10 ordered by date DESC', async () => {
    const { wallet } = await makeBankAndWallet(USER_A);
    for (let i = 0; i < 12; i++) {
      await prisma.transaction.create({
        data: {
          user_id: USER_A,
          wallet_id: wallet.id,
          type: 'EXPENSE',
          amount: '1.00',
          date: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1 + i)),
        },
      });
    }

    const res = await request(createApp())
      .get('/dashboard')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as DashboardBody;

    expect(body.recent_transactions).toHaveLength(10);
  });

  it('recent_transactions includes only EXPENSE side of transfers with paired_wallet_name', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'Santander' } });
    const wOrigen = await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'Origen' },
    });
    const wDestino = await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'Destino' },
    });
    const transferId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    await prisma.transaction.createMany({
      data: [
        {
          user_id: USER_A,
          wallet_id: wOrigen.id,
          type: 'EXPENSE',
          amount: '50.00',
          date: currentMonthDate,
          transfer_id: transferId,
        },
        {
          user_id: USER_A,
          wallet_id: wDestino.id,
          type: 'INCOME',
          amount: '50.00',
          date: currentMonthDate,
          transfer_id: transferId,
        },
      ],
    });

    const res = await request(createApp())
      .get('/dashboard')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as DashboardBody;

    const transferLegs = body.recent_transactions.filter((t) => t.transfer_id !== null);
    expect(transferLegs).toHaveLength(1);
    expect(transferLegs[0]).toMatchObject({ type: 'EXPENSE', paired_wallet_name: 'Destino' });
  });
});
