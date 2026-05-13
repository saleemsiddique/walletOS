import { prisma } from '../lib/prisma';

const USER_ID = 'a0000000-0000-0000-0000-000000000001';

async function createBank(overrides: Partial<Parameters<typeof prisma.bank.create>[0]['data']> = {}) {
  return prisma.bank.create({
    data: { user_id: USER_ID, name: 'Test Bank', ...overrides },
  });
}

describe('Bank', () => {
  it('creates with defaults', async () => {
    const bank = await createBank();
    expect(bank.icon).toBe('🏦');
    expect(bank.color).toBe('#007AFF');
    expect(bank.is_archived).toBe(false);
  });
});

describe('Wallet', () => {
  it('creates with bank relation', async () => {
    const bank = await createBank();
    const wallet = await prisma.wallet.create({
      data: { bank_id: bank.id, user_id: USER_ID, name: 'Nómina' },
    });
    expect(wallet.bank_id).toBe(bank.id);
    expect(wallet.type).toBe('CASH');
    expect(wallet.initial_balance.toString()).toBe('0');
  });

  it('creates with type INVESTMENT', async () => {
    const bank = await createBank();
    const wallet = await prisma.wallet.create({
      data: { bank_id: bank.id, user_id: USER_ID, name: 'Trade Republic', type: 'INVESTMENT' },
    });
    expect(wallet.type).toBe('INVESTMENT');
  });

  it('cascade deletes wallets when bank is deleted', async () => {
    const bank = await createBank();
    await prisma.wallet.create({
      data: { bank_id: bank.id, user_id: USER_ID, name: 'Ahorro' },
    });
    await prisma.bank.delete({ where: { id: bank.id } });
    const wallets = await prisma.wallet.findMany({ where: { bank_id: bank.id } });
    expect(wallets).toHaveLength(0);
  });
});

describe('Category', () => {
  it('creates predefined category with user_id null', async () => {
    const cat = await prisma.category.create({
      data: { name: 'Comida', icon: '🍔', type: 'EXPENSE', user_id: null },
    });
    expect(cat.user_id).toBeNull();
  });

  it('rejects duplicate (user_id, name, type)', async () => {
    await prisma.category.create({
      data: { user_id: USER_ID, name: 'Gym', icon: '💪', type: 'EXPENSE' },
    });
    await expect(
      prisma.category.create({
        data: { user_id: USER_ID, name: 'Gym', icon: '💪', type: 'EXPENSE' },
      }),
    ).rejects.toThrow();
  });
});

describe('Transaction', () => {
  it('creates with category_id null (transferencia)', async () => {
    const bank = await createBank();
    const wallet = await prisma.wallet.create({
      data: { bank_id: bank.id, user_id: USER_ID, name: 'Nómina' },
    });
    const tx = await prisma.transaction.create({
      data: {
        wallet_id: wallet.id,
        user_id: USER_ID,
        type: 'EXPENSE',
        amount: 100,
        date: new Date('2026-05-01'),
        category_id: null,
      },
    });
    expect(tx.category_id).toBeNull();
  });

  it('cascade deletes transactions when wallet is deleted', async () => {
    const bank = await createBank();
    const wallet = await prisma.wallet.create({
      data: { bank_id: bank.id, user_id: USER_ID, name: 'Nómina' },
    });
    await prisma.transaction.create({
      data: {
        wallet_id: wallet.id,
        user_id: USER_ID,
        type: 'INCOME',
        amount: 2000,
        date: new Date('2026-05-01'),
      },
    });
    await prisma.wallet.delete({ where: { id: wallet.id } });
    const txs = await prisma.transaction.findMany({ where: { wallet_id: wallet.id } });
    expect(txs).toHaveLength(0);
  });
});

describe('RecurringRule', () => {
  it('creates with frequency MONTHLY and day_of_month', async () => {
    const bank = await createBank();
    const wallet = await prisma.wallet.create({
      data: { bank_id: bank.id, user_id: USER_ID, name: 'Nómina' },
    });
    const rule = await prisma.recurringRule.create({
      data: {
        user_id: USER_ID,
        wallet_id: wallet.id,
        type: 'EXPENSE',
        amount: 9.99,
        frequency: 'MONTHLY',
        day_of_month: 15,
        starts_at: new Date('2026-05-15'),
        next_run: new Date('2026-05-15'),
      },
    });
    expect(rule.frequency).toBe('MONTHLY');
    expect(rule.day_of_month).toBe(15);
    expect(rule.is_active).toBe(true);
  });
});
