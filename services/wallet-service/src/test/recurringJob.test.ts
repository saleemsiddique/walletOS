import { vi } from 'vitest';

vi.mock('../lib/rabbitmq', () => ({
  connectRabbitMQ: vi.fn(),
  publishEvent: vi.fn(),
}));

import { prisma } from '../lib/prisma';
import { publishEvent } from '../lib/rabbitmq';
import { runRecurringJob } from '../jobs/recurring.job';
import { seedCategories } from '../lib/seed';

const USER_A = 'a0000000-0000-0000-0000-000000000001';

async function makeWallet(userId: string): Promise<string> {
  const bank = await prisma.bank.create({ data: { user_id: userId, name: 'Santander' } });
  const wallet = await prisma.wallet.create({
    data: { user_id: userId, bank_id: bank.id, name: 'Nómina' },
  });
  return wallet.id;
}

const utc = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

describe('runRecurringJob', () => {
  beforeEach(async () => {
    await seedCategories();
    vi.mocked(publishEvent).mockClear();
  });

  it('materializes rules with next_run <= now and advances next_run', async () => {
    const walletId = await makeWallet(USER_A);
    const cat = await prisma.category.findFirstOrThrow({
      where: { user_id: null, name: 'Suscripciones', type: 'EXPENSE' },
    });
    const rule = await prisma.recurringRule.create({
      data: {
        user_id: USER_A,
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: '9.99',
        category_id: cat.id,
        note: 'Spotify',
        frequency: 'MONTHLY',
        day_of_month: 15,
        starts_at: utc('2026-04-15'),
        next_run: utc('2026-05-15'),
      },
    });

    const result = await runRecurringJob(utc('2026-05-15'));
    expect(result.materialized).toBe(1);

    const txs = await prisma.transaction.findMany({ where: { wallet_id: walletId } });
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ type: 'EXPENSE', note: 'Spotify' });
    expect(txs[0]?.amount.toNumber()).toBe(9.99);
    expect(txs[0]?.date.toISOString().slice(0, 10)).toBe('2026-05-15');

    const updated = await prisma.recurringRule.findUniqueOrThrow({ where: { id: rule.id } });
    expect(updated.next_run.toISOString().slice(0, 10)).toBe('2026-06-15');

    expect(publishEvent).toHaveBeenCalledOnce();
    const [routingKey, payload] = vi.mocked(publishEvent).mock.calls[0] ?? [];
    expect(routingKey).toBe('transaction.created');
    expect(payload).toMatchObject({
      event: 'transaction.created',
      data: {
        user_id: USER_A,
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: 9.99,
        category_id: cat.id,
        category_name: 'Suscripciones',
        date: '2026-05-15',
        transfer_id: null,
      },
    });
  });

  it('materializes rules with next_run in the past', async () => {
    const walletId = await makeWallet(USER_A);
    await prisma.recurringRule.create({
      data: {
        user_id: USER_A,
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: '1.00',
        frequency: 'DAILY',
        starts_at: utc('2026-05-01'),
        next_run: utc('2026-05-01'),
      },
    });

    const result = await runRecurringJob(utc('2026-05-10'));
    expect(result.materialized).toBe(1);

    const tx = await prisma.transaction.findFirstOrThrow({ where: { wallet_id: walletId } });
    expect(tx.date.toISOString().slice(0, 10)).toBe('2026-05-01');
  });

  it('does not materialize rules with next_run in the future', async () => {
    const walletId = await makeWallet(USER_A);
    await prisma.recurringRule.create({
      data: {
        user_id: USER_A,
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: '1.00',
        frequency: 'DAILY',
        starts_at: utc('2026-06-01'),
        next_run: utc('2026-06-01'),
      },
    });

    const result = await runRecurringJob(utc('2026-05-10'));
    expect(result.materialized).toBe(0);

    const count = await prisma.transaction.count({ where: { wallet_id: walletId } });
    expect(count).toBe(0);
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it('does not materialize inactive rules', async () => {
    const walletId = await makeWallet(USER_A);
    await prisma.recurringRule.create({
      data: {
        user_id: USER_A,
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: '1.00',
        frequency: 'DAILY',
        starts_at: utc('2026-05-01'),
        next_run: utc('2026-05-01'),
        is_active: false,
      },
    });

    const result = await runRecurringJob(utc('2026-05-10'));
    expect(result.materialized).toBe(0);
    expect(publishEvent).not.toHaveBeenCalled();
  });

  it('publishes one event per materialized transaction', async () => {
    const walletId = await makeWallet(USER_A);
    await prisma.recurringRule.createMany({
      data: [
        {
          user_id: USER_A,
          wallet_id: walletId,
          type: 'EXPENSE',
          amount: '1.00',
          frequency: 'DAILY',
          starts_at: utc('2026-05-01'),
          next_run: utc('2026-05-01'),
        },
        {
          user_id: USER_A,
          wallet_id: walletId,
          type: 'INCOME',
          amount: '100.00',
          frequency: 'DAILY',
          starts_at: utc('2026-05-01'),
          next_run: utc('2026-05-01'),
        },
      ],
    });

    const result = await runRecurringJob(utc('2026-05-10'));
    expect(result.materialized).toBe(2);
    expect(publishEvent).toHaveBeenCalledTimes(2);
  });
});
