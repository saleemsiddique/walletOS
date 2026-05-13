import { Decimal } from '@prisma/client/runtime/library';
import { calculateWalletBalance, calculateUserTotalBalance } from '../lib/balance';
import { prisma } from '../lib/prisma';

const USER_ID = 'b0000000-0000-0000-0000-000000000001';

async function setupWallet(initialBalance = 0) {
  const bank = await prisma.bank.create({
    data: { user_id: USER_ID, name: 'Test Bank' },
  });
  return prisma.wallet.create({
    data: { bank_id: bank.id, user_id: USER_ID, name: 'Test Wallet', initial_balance: initialBalance },
  });
}

describe('calculateWalletBalance', () => {
  it('returns initial_balance when no transactions', async () => {
    const wallet = await setupWallet(500);
    const balance = await calculateWalletBalance(wallet.id);
    expect(balance.toNumber()).toBe(500);
  });

  it('adds INCOME transactions', async () => {
    const wallet = await setupWallet(100);
    await prisma.transaction.create({
      data: { wallet_id: wallet.id, user_id: USER_ID, type: 'INCOME', amount: 200, date: new Date() },
    });
    const balance = await calculateWalletBalance(wallet.id);
    expect(balance.toNumber()).toBe(300);
  });

  it('subtracts EXPENSE transactions', async () => {
    const wallet = await setupWallet(500);
    await prisma.transaction.create({
      data: { wallet_id: wallet.id, user_id: USER_ID, type: 'EXPENSE', amount: 150, date: new Date() },
    });
    const balance = await calculateWalletBalance(wallet.id);
    expect(balance.toNumber()).toBe(350);
  });
});

describe('calculateUserTotalBalance', () => {
  it('sums balances across multiple CASH wallets', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_ID, name: 'Bank' } });
    await prisma.wallet.createMany({
      data: [
        { bank_id: bank.id, user_id: USER_ID, name: 'W1', initial_balance: 300 },
        { bank_id: bank.id, user_id: USER_ID, name: 'W2', initial_balance: 200 },
      ],
    });
    const total = await calculateUserTotalBalance(USER_ID);
    expect(total.toNumber()).toBe(500);
  });

  it('excludes archived wallets', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_ID, name: 'Bank' } });
    await prisma.wallet.createMany({
      data: [
        { bank_id: bank.id, user_id: USER_ID, name: 'Active', initial_balance: 400 },
        { bank_id: bank.id, user_id: USER_ID, name: 'Archived', initial_balance: 999, is_archived: true },
      ],
    });
    const total = await calculateUserTotalBalance(USER_ID);
    expect(total.toNumber()).toBe(400);
  });

  it('excludes INVESTMENT wallets', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_ID, name: 'Bank' } });
    await prisma.wallet.createMany({
      data: [
        { bank_id: bank.id, user_id: USER_ID, name: 'Cash', initial_balance: 300 },
        { bank_id: bank.id, user_id: USER_ID, name: 'Portfolio', initial_balance: 0, type: 'INVESTMENT' },
      ],
    });
    const total = await calculateUserTotalBalance(USER_ID);
    expect(total.toNumber()).toBe(300);
  });

  it('returns 0 when user has no wallets', async () => {
    const total = await calculateUserTotalBalance('00000000-0000-0000-0000-000000000099');
    expect(total).toEqual(new Decimal(0));
  });
});
