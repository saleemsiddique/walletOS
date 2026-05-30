import type { Category, Transaction } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { publishEvent } from '../lib/rabbitmq';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../middleware/errorHandler';
import type { CreateTransactionInput } from '../validators/transaction.validators';

export type TransactionDTO = {
  id: string;
  wallet_id: string;
  wallet_name: string;
  bank_name: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: { id: string; name: string; icon: string } | null;
  note: string | null;
  date: string;
  transfer_id: string | null;
  paired_wallet_name: string | null;
  created_at: Date;
};

type TransactionWithRelations = Transaction & {
  wallet: { name: string; bank: { name: string } };
  category: Category | null;
};

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toDTO(tx: TransactionWithRelations, pairedWalletName: string | null): TransactionDTO {
  return {
    id: tx.id,
    wallet_id: tx.wallet_id,
    wallet_name: tx.wallet.name,
    bank_name: tx.wallet.bank.name,
    type: tx.type,
    amount: tx.amount.toNumber(),
    category: tx.category
      ? { id: tx.category.id, name: tx.category.name, icon: tx.category.icon }
      : null,
    note: tx.note,
    date: toDateString(tx.date),
    transfer_id: tx.transfer_id,
    paired_wallet_name: pairedWalletName,
    created_at: tx.created_at,
  };
}

async function loadOwnedWallet(userId: string, walletId: string): Promise<void> {
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    select: { user_id: true },
  });
  if (!wallet || wallet.user_id !== userId) throw new NotFoundError('Wallet not found');
}

async function validateCategoryForUser(
  userId: string,
  categoryId: string,
  txType: 'INCOME' | 'EXPENSE',
): Promise<void> {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { user_id: true, type: true },
  });
  if (!category || (category.user_id !== null && category.user_id !== userId)) {
    throw new ValidationError('Category not found for user');
  }
  if (category.type !== txType) {
    throw new ValidationError('Category type does not match transaction type');
  }
}

export async function createTransaction(
  userId: string,
  walletId: string,
  input: CreateTransactionInput,
): Promise<TransactionDTO> {
  await loadOwnedWallet(userId, walletId);

  if (input.category_id !== undefined) {
    await validateCategoryForUser(userId, input.category_id, input.type);
  }

  const date = input.date !== undefined ? new Date(input.date) : new Date();

  let created: TransactionWithRelations;
  try {
    created = await prisma.transaction.create({
      data: {
        ...(input.id !== undefined && { id: input.id }),
        user_id: userId,
        wallet_id: walletId,
        type: input.type,
        amount: new Decimal(input.amount),
        ...(input.category_id !== undefined && { category_id: input.category_id }),
        ...(input.note !== undefined && { note: input.note }),
        date,
      },
      include: { wallet: { include: { bank: true } }, category: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictError('Transaction id already exists');
    }
    throw err;
  }

  publishEvent('transaction.created', {
    event: 'transaction.created',
    timestamp: new Date().toISOString(),
    data: {
      user_id: userId,
      transaction_id: created.id,
      wallet_id: created.wallet_id,
      type: created.type,
      amount: created.amount.toNumber(),
      category_id: created.category_id,
      category_name: created.category?.name ?? null,
      date: toDateString(created.date),
      transfer_id: created.transfer_id,
    },
  });

  return toDTO(created, null);
}
