import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from './prisma';

export async function calculateWalletBalance(walletId: string): Promise<Decimal> {
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    select: { initial_balance: true },
  });

  if (!wallet) return new Decimal(0);

  const aggregate = await prisma.transaction.groupBy({
    by: ['type'],
    where: { wallet_id: walletId },
    _sum: { amount: true },
  });

  let income = new Decimal(0);
  let expense = new Decimal(0);

  for (const row of aggregate) {
    const sum = row._sum.amount ?? new Decimal(0);
    if (row.type === 'INCOME') income = sum;
    else expense = sum;
  }

  return wallet.initial_balance.add(income).sub(expense);
}

export async function calculateUserTotalBalance(userId: string): Promise<Decimal> {
  const wallets = await prisma.wallet.findMany({
    where: { user_id: userId, is_archived: false, type: 'CASH' },
    select: { id: true },
  });

  let total = new Decimal(0);
  for (const wallet of wallets) {
    const balance = await calculateWalletBalance(wallet.id);
    total = total.add(balance);
  }
  return total;
}
