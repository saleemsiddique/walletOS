import type { InvestmentTransaction, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import type {
  CreateInvestmentTransactionInput,
  ListInvestmentTransactionsQuery,
} from '../validators/investment-transaction.validators';

export type InvestmentTransactionDTO = {
  id: string;
  wallet_id: string;
  ticker: string;
  asset_name: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND';
  shares: string;
  price_per_share: string;
  total_amount: string;
  currency: string;
  note: string | null;
  date: string;
  created_at: Date;
};

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toDTO(tx: InvestmentTransaction): InvestmentTransactionDTO {
  return {
    id: tx.id,
    wallet_id: tx.wallet_id,
    ticker: tx.ticker,
    asset_name: tx.asset_name,
    type: tx.type,
    shares: tx.shares.toString(),
    price_per_share: tx.price_per_share.toString(),
    total_amount: tx.total_amount.toString(),
    currency: tx.currency,
    note: tx.note,
    date: toDateString(tx.date),
    created_at: tx.created_at,
  };
}

async function loadInvestmentWallet(userId: string, walletId: string): Promise<void> {
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    select: { user_id: true, type: true },
  });
  if (!wallet || wallet.user_id !== userId) throw new NotFoundError('Wallet not found');
  if (wallet.type !== 'INVESTMENT') {
    throw new ValidationError('Wallet must be of type INVESTMENT');
  }
}

export async function createInvestmentTransaction(
  userId: string,
  walletId: string,
  input: CreateInvestmentTransactionInput,
): Promise<InvestmentTransactionDTO> {
  await loadInvestmentWallet(userId, walletId);

  const shares = new Decimal(input.shares);
  const pricePerShare = new Decimal(input.price_per_share);
  const totalAmount = shares.mul(pricePerShare).toDecimalPlaces(2);
  const date = input.date !== undefined ? new Date(input.date) : new Date();

  const created = await prisma.investmentTransaction.create({
    data: {
      user_id: userId,
      wallet_id: walletId,
      ticker: input.ticker,
      asset_name: input.asset_name,
      type: input.type,
      shares,
      price_per_share: pricePerShare,
      total_amount: totalAmount,
      ...(input.currency !== undefined && { currency: input.currency }),
      ...(input.note !== undefined && { note: input.note }),
      date,
    },
  });
  return toDTO(created);
}

export async function deleteInvestmentTransaction(userId: string, id: string): Promise<void> {
  const tx = await prisma.investmentTransaction.findUnique({
    where: { id },
    select: { user_id: true },
  });
  if (!tx || tx.user_id !== userId) {
    throw new NotFoundError('Investment transaction not found');
  }
  await prisma.investmentTransaction.delete({ where: { id } });
}

export async function listInvestmentTransactions(
  userId: string,
  walletId: string,
  query: ListInvestmentTransactionsQuery,
): Promise<{ transactions: InvestmentTransactionDTO[]; next_cursor: string | null }> {
  await loadInvestmentWallet(userId, walletId);

  const dateFilter: Prisma.DateTimeFilter | undefined =
    query.from !== undefined || query.to !== undefined
      ? {
          ...(query.from !== undefined && { gte: new Date(query.from) }),
          ...(query.to !== undefined && { lte: new Date(query.to) }),
        }
      : undefined;

  const baseWhere: Prisma.InvestmentTransactionWhereInput = {
    wallet_id: walletId,
    ...(query.ticker !== undefined && { ticker: query.ticker }),
    ...(query.type !== undefined && { type: query.type }),
    ...(dateFilter !== undefined && { date: dateFilter }),
  };

  let where: Prisma.InvestmentTransactionWhereInput = baseWhere;
  if (query.cursor !== undefined) {
    const cursorTx = await prisma.investmentTransaction.findUnique({
      where: { id: query.cursor },
      select: { date: true, created_at: true, id: true },
    });
    if (cursorTx === null) return { transactions: [], next_cursor: null };
    where = {
      AND: [
        baseWhere,
        {
          OR: [
            { date: { lt: cursorTx.date } },
            {
              AND: [
                { date: cursorTx.date },
                {
                  OR: [
                    { created_at: { lt: cursorTx.created_at } },
                    {
                      AND: [
                        { created_at: cursorTx.created_at },
                        { id: { lt: cursorTx.id } },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  }

  const rows = await prisma.investmentTransaction.findMany({
    where,
    orderBy: [{ date: 'desc' }, { created_at: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  return {
    transactions: page.map(toDTO),
    next_cursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}
