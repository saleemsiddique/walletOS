import { randomUUID } from 'crypto';
import type { Transaction } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../middleware/errorHandler';
import type { CreateTransferInput } from '../validators/transfer.validators';

type TransferLegDTO = {
  id: string;
  wallet_id: string;
  wallet_name: string;
  bank_name: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: null;
  note: string | null;
  date: string;
  transfer_id: string;
  paired_wallet_name: string;
  created_at: Date;
};

export type TransferResponse = {
  transfer_id: string;
  expense: TransferLegDTO;
  income: TransferLegDTO;
};

type WalletWithBank = { id: string; name: string; user_id: string; bank: { name: string } };

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toLegDTO(
  tx: Transaction,
  wallet: WalletWithBank,
  pairedWalletName: string,
): TransferLegDTO {
  return {
    id: tx.id,
    wallet_id: tx.wallet_id,
    wallet_name: wallet.name,
    bank_name: wallet.bank.name,
    type: tx.type,
    amount: tx.amount.toNumber(),
    category: null,
    note: tx.note,
    date: toDateString(tx.date),
    transfer_id: tx.transfer_id as string,
    paired_wallet_name: pairedWalletName,
    created_at: tx.created_at,
  };
}

export async function createTransfer(
  userId: string,
  input: CreateTransferInput,
): Promise<TransferResponse> {
  const [fromWallet, toWallet] = await Promise.all([
    prisma.wallet.findUnique({
      where: { id: input.from_wallet_id },
      include: { bank: { select: { name: true } } },
    }),
    prisma.wallet.findUnique({
      where: { id: input.to_wallet_id },
      include: { bank: { select: { name: true } } },
    }),
  ]);

  if (!fromWallet || fromWallet.user_id !== userId) {
    throw new NotFoundError('from_wallet not found');
  }
  if (!toWallet || toWallet.user_id !== userId) {
    throw new NotFoundError('to_wallet not found');
  }

  const transferId = randomUUID();
  const date = input.date !== undefined ? new Date(input.date) : new Date();
  const amount = new Decimal(input.amount);

  const [expense, income] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        user_id: userId,
        wallet_id: fromWallet.id,
        type: 'EXPENSE',
        amount,
        date,
        ...(input.note !== undefined && { note: input.note }),
        transfer_id: transferId,
      },
    }),
    prisma.transaction.create({
      data: {
        user_id: userId,
        wallet_id: toWallet.id,
        type: 'INCOME',
        amount,
        date,
        ...(input.note !== undefined && { note: input.note }),
        transfer_id: transferId,
      },
    }),
  ]);

  return {
    transfer_id: transferId,
    expense: toLegDTO(expense, fromWallet, toWallet.name),
    income: toLegDTO(income, toWallet, fromWallet.name),
  };
}
