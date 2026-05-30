import type { InvestmentTransaction } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';
import type { CreateInvestmentTransactionInput } from '../validators/investment-transaction.validators';

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
