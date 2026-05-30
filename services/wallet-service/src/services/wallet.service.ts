import type { Wallet } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../middleware/errorHandler';
import type {
  CreateWalletInput,
  UpdateWalletInput,
} from '../validators/wallet.validators';

export type WalletDTO = {
  id: string;
  bank_id: string;
  name: string;
  icon: string;
  color: string;
  balance: number;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
};

function toDTO(wallet: Wallet, balance: Decimal): WalletDTO {
  return {
    id: wallet.id,
    bank_id: wallet.bank_id,
    name: wallet.name,
    icon: wallet.icon,
    color: wallet.color,
    balance: balance.toNumber(),
    is_archived: wallet.is_archived,
    created_at: wallet.created_at,
    updated_at: wallet.updated_at,
  };
}

async function loadOwnedBank(userId: string, bankId: string): Promise<void> {
  const bank = await prisma.bank.findUnique({
    where: { id: bankId },
    select: { user_id: true },
  });
  if (!bank || bank.user_id !== userId) throw new NotFoundError('Bank not found');
}

async function balancesForWallets(walletIds: string[]): Promise<Map<string, Decimal>> {
  const out = new Map<string, Decimal>();
  if (walletIds.length === 0) return out;

  const aggregates = await prisma.transaction.groupBy({
    by: ['wallet_id', 'type'],
    where: { wallet_id: { in: walletIds } },
    _sum: { amount: true },
  });

  const sums = new Map<string, { income: Decimal; expense: Decimal }>();
  for (const row of aggregates) {
    const entry = sums.get(row.wallet_id) ?? { income: new Decimal(0), expense: new Decimal(0) };
    const sum = row._sum.amount ?? new Decimal(0);
    if (row.type === 'INCOME') entry.income = entry.income.add(sum);
    else entry.expense = entry.expense.add(sum);
    sums.set(row.wallet_id, entry);
  }

  for (const id of walletIds) {
    const s = sums.get(id) ?? { income: new Decimal(0), expense: new Decimal(0) };
    out.set(id, s.income.sub(s.expense));
  }
  return out;
}

export async function createWallet(
  userId: string,
  bankId: string,
  input: CreateWalletInput,
): Promise<WalletDTO> {
  await loadOwnedBank(userId, bankId);

  const wallet = await prisma.wallet.create({
    data: {
      user_id: userId,
      bank_id: bankId,
      name: input.name,
      ...(input.type !== undefined && { type: input.type }),
      ...(input.initial_balance !== undefined && {
        initial_balance: new Decimal(input.initial_balance),
      }),
      ...(input.icon !== undefined && { icon: input.icon }),
      ...(input.color !== undefined && { color: input.color }),
    },
  });
  return toDTO(wallet, wallet.initial_balance);
}

export type WalletFlatDTO = WalletDTO & { bank_name: string };

export async function listAllWallets(userId: string): Promise<{ wallets: WalletFlatDTO[] }> {
  const wallets = await prisma.wallet.findMany({
    where: { user_id: userId, is_archived: false },
    orderBy: { created_at: 'asc' },
    include: { bank: { select: { name: true } } },
  });

  const deltas = await balancesForWallets(wallets.map((w) => w.id));
  return {
    wallets: wallets.map((w) => ({
      ...toDTO(w, w.initial_balance.add(deltas.get(w.id) ?? new Decimal(0))),
      bank_name: w.bank.name,
    })),
  };
}

async function loadOwnedWallet(userId: string, walletId: string): Promise<Wallet> {
  const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
  if (!wallet || wallet.user_id !== userId) throw new NotFoundError('Wallet not found');
  return wallet;
}

export async function updateWallet(
  userId: string,
  walletId: string,
  input: UpdateWalletInput,
): Promise<WalletDTO> {
  await loadOwnedWallet(userId, walletId);

  const updated = await prisma.wallet.update({
    where: { id: walletId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.icon !== undefined && { icon: input.icon }),
      ...(input.color !== undefined && { color: input.color }),
    },
  });

  const deltas = await balancesForWallets([walletId]);
  return toDTO(updated, updated.initial_balance.add(deltas.get(walletId) ?? new Decimal(0)));
}

export async function archiveWallet(userId: string, walletId: string): Promise<WalletDTO> {
  await loadOwnedWallet(userId, walletId);

  const archived = await prisma.wallet.update({
    where: { id: walletId },
    data: { is_archived: true },
  });

  const deltas = await balancesForWallets([walletId]);
  return toDTO(archived, archived.initial_balance.add(deltas.get(walletId) ?? new Decimal(0)));
}

export async function listWalletsByBank(
  userId: string,
  bankId: string,
): Promise<{ wallets: WalletDTO[] }> {
  await loadOwnedBank(userId, bankId);

  const wallets = await prisma.wallet.findMany({
    where: { bank_id: bankId, is_archived: false },
    orderBy: { created_at: 'asc' },
  });

  const deltas = await balancesForWallets(wallets.map((w) => w.id));
  return {
    wallets: wallets.map((w) =>
      toDTO(w, w.initial_balance.add(deltas.get(w.id) ?? new Decimal(0))),
    ),
  };
}
