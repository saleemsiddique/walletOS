import { prisma } from '../lib/prisma';

export type InternalTransactionDTO = {
  id: string;
  wallet_id: string;
  wallet_name: string;
  bank_name: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: { id: string; name: string; icon: string; type: 'INCOME' | 'EXPENSE' } | null;
  note: string | null;
  date: string;
  transfer_id: string | null;
  created_at: Date;
};

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function listUserTransactionsInternal(
  userId: string,
  from: string,
  to: string,
): Promise<{ transactions: InternalTransactionDTO[] }> {
  const fromDate = new Date(from);
  const toExclusive = new Date(to);
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);

  const rows = await prisma.transaction.findMany({
    where: {
      user_id: userId,
      date: { gte: fromDate, lt: toExclusive },
      transfer_id: null,
    },
    orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
    include: { wallet: { include: { bank: true } }, category: true },
  });

  return {
    transactions: rows.map((tx) => ({
      id: tx.id,
      wallet_id: tx.wallet_id,
      wallet_name: tx.wallet.name,
      bank_name: tx.wallet.bank.name,
      type: tx.type,
      amount: tx.amount.toNumber(),
      category: tx.category
        ? {
            id: tx.category.id,
            name: tx.category.name,
            icon: tx.category.icon,
            type: tx.category.type,
          }
        : null,
      note: tx.note,
      date: toDateString(tx.date),
      transfer_id: tx.transfer_id,
      created_at: tx.created_at,
    })),
  };
}
