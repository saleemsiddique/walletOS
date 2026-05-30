import { vi } from 'vitest';

vi.mock('../lib/rabbitmq', () => ({
  connectRabbitMQ: vi.fn(),
  publishEvent: vi.fn(),
  subscribe: vi.fn(),
}));

import { prisma } from '../lib/prisma';
import { getRedis } from '../lib/redis';
import { handleUserDeleted } from '../consumers/userDeleted.consumer';
import { seedCategories } from '../lib/seed';

const USER_A = 'a0000000-0000-0000-0000-000000000001';
const USER_B = 'b0000000-0000-0000-0000-000000000002';

async function makeFullDataset(userId: string) {
  const bank = await prisma.bank.create({ data: { user_id: userId, name: 'Santander' } });
  const wallet = await prisma.wallet.create({
    data: { user_id: userId, bank_id: bank.id, name: 'Nómina' },
  });
  await prisma.transaction.create({
    data: {
      user_id: userId,
      wallet_id: wallet.id,
      type: 'EXPENSE',
      amount: '10.00',
      date: new Date('2026-05-01'),
    },
  });
  await prisma.recurringRule.create({
    data: {
      user_id: userId,
      wallet_id: wallet.id,
      type: 'EXPENSE',
      amount: '1.00',
      frequency: 'DAILY',
      starts_at: new Date('2026-05-01'),
      next_run: new Date('2026-05-01'),
    },
  });
  await prisma.category.create({
    data: { user_id: userId, name: 'Mía', icon: '🎯', type: 'EXPENSE' },
  });
}

describe('handleUserDeleted', () => {
  beforeEach(async () => {
    await seedCategories();
  });

  it('cascades delete of banks, wallets, transactions, recurring and custom categories', async () => {
    await makeFullDataset(USER_A);

    await handleUserDeleted({ event: 'user.deleted', data: { user_id: USER_A } });

    expect(await prisma.bank.count({ where: { user_id: USER_A } })).toBe(0);
    expect(await prisma.wallet.count({ where: { user_id: USER_A } })).toBe(0);
    expect(await prisma.transaction.count({ where: { user_id: USER_A } })).toBe(0);
    expect(await prisma.recurringRule.count({ where: { user_id: USER_A } })).toBe(0);
    expect(await prisma.category.count({ where: { user_id: USER_A } })).toBe(0);

    // Predefined categories (user_id=null) survive.
    expect(await prisma.category.count({ where: { user_id: null } })).toBe(14);
  });

  it('does not affect data of other users', async () => {
    await makeFullDataset(USER_A);
    await makeFullDataset(USER_B);

    await handleUserDeleted({ event: 'user.deleted', data: { user_id: USER_A } });

    expect(await prisma.bank.count({ where: { user_id: USER_B } })).toBe(1);
    expect(await prisma.wallet.count({ where: { user_id: USER_B } })).toBe(1);
    expect(await prisma.transaction.count({ where: { user_id: USER_B } })).toBe(1);
    expect(await prisma.recurringRule.count({ where: { user_id: USER_B } })).toBe(1);
    expect(await prisma.category.count({ where: { user_id: USER_B } })).toBe(1);
  });

  it('invalidates the redis categories cache for the deleted user', async () => {
    await makeFullDataset(USER_A);
    const cacheKey = `internal:categories:${USER_A}`;
    await getRedis().set(cacheKey, JSON.stringify({ categories: [] }), 'EX', 60);
    expect(await getRedis().get(cacheKey)).not.toBeNull();

    await handleUserDeleted({ event: 'user.deleted', data: { user_id: USER_A } });

    expect(await getRedis().get(cacheKey)).toBeNull();
  });

  it('throws on invalid payload', async () => {
    await expect(handleUserDeleted({ event: 'user.deleted' })).rejects.toThrow();
    await expect(handleUserDeleted({ event: 'user.deleted', data: {} })).rejects.toThrow();
    await expect(
      handleUserDeleted({ event: 'user.deleted', data: { user_id: '' } }),
    ).rejects.toThrow();
  });
});
