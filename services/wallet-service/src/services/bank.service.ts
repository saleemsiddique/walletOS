import type { Bank } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../middleware/errorHandler';
import type { CreateBankInput, UpdateBankInput } from '../validators/bank.validators';

export type BankDTO = {
  id: string;
  name: string;
  icon: string;
  color: string;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
};

function toDTO(bank: Bank): BankDTO {
  return {
    id: bank.id,
    name: bank.name,
    icon: bank.icon,
    color: bank.color,
    is_archived: bank.is_archived,
    created_at: bank.created_at,
    updated_at: bank.updated_at,
  };
}

type WalletWithBalance = {
  id: string;
  name: string;
  icon: string;
  color: string;
  balance: number;
};

type BankWithWalletsDTO = {
  id: string;
  name: string;
  icon: string;
  color: string;
  wallets: WalletWithBalance[];
  total_balance: number;
};

export async function listBanks(
  userId: string,
): Promise<{ banks: BankWithWalletsDTO[]; total_balance: number }> {
  const banks = await prisma.bank.findMany({
    where: { user_id: userId, is_archived: false },
    orderBy: { created_at: 'asc' },
    include: {
      wallets: {
        where: { is_archived: false },
        orderBy: { created_at: 'asc' },
      },
    },
  });

  const walletIds = banks.flatMap((b) => b.wallets.map((w) => w.id));
  const sumsByWallet = new Map<string, { income: Decimal; expense: Decimal }>();

  if (walletIds.length > 0) {
    const aggregates = await prisma.transaction.groupBy({
      by: ['wallet_id', 'type'],
      where: { wallet_id: { in: walletIds } },
      _sum: { amount: true },
    });

    for (const row of aggregates) {
      const entry = sumsByWallet.get(row.wallet_id) ?? {
        income: new Decimal(0),
        expense: new Decimal(0),
      };
      const sum = row._sum.amount ?? new Decimal(0);
      if (row.type === 'INCOME') entry.income = entry.income.add(sum);
      else entry.expense = entry.expense.add(sum);
      sumsByWallet.set(row.wallet_id, entry);
    }
  }

  let grandTotal = new Decimal(0);
  const banksDTO = banks.map((bank) => {
    let bankTotal = new Decimal(0);
    const wallets = bank.wallets.map((w) => {
      const sums = sumsByWallet.get(w.id) ?? { income: new Decimal(0), expense: new Decimal(0) };
      const balance = w.initial_balance.add(sums.income).sub(sums.expense);
      bankTotal = bankTotal.add(balance);
      return {
        id: w.id,
        name: w.name,
        icon: w.icon,
        color: w.color,
        balance: balance.toNumber(),
      };
    });
    grandTotal = grandTotal.add(bankTotal);
    return {
      id: bank.id,
      name: bank.name,
      icon: bank.icon,
      color: bank.color,
      wallets,
      total_balance: bankTotal.toNumber(),
    };
  });

  return { banks: banksDTO, total_balance: grandTotal.toNumber() };
}

export async function createBank(userId: string, input: CreateBankInput): Promise<BankDTO> {
  const bank = await prisma.bank.create({
    data: {
      user_id: userId,
      name: input.name,
      ...(input.icon !== undefined && { icon: input.icon }),
      ...(input.color !== undefined && { color: input.color }),
    },
  });
  return toDTO(bank);
}

async function loadOwnedBank(userId: string, id: string): Promise<Bank> {
  const bank = await prisma.bank.findUnique({ where: { id } });
  if (!bank || bank.user_id !== userId) throw new NotFoundError('Bank not found');
  return bank;
}

export async function archiveBank(userId: string, id: string): Promise<BankDTO> {
  await loadOwnedBank(userId, id);

  const [, archived] = await prisma.$transaction([
    prisma.wallet.updateMany({
      where: { bank_id: id, is_archived: false },
      data: { is_archived: true },
    }),
    prisma.bank.update({ where: { id }, data: { is_archived: true } }),
  ]);
  return toDTO(archived);
}

export async function updateBank(
  userId: string,
  id: string,
  input: UpdateBankInput,
): Promise<BankDTO> {
  await loadOwnedBank(userId, id);

  const updated = await prisma.bank.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.icon !== undefined && { icon: input.icon }),
      ...(input.color !== undefined && { color: input.color }),
    },
  });
  return toDTO(updated);
}
