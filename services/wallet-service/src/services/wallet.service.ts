import type { Wallet } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../middleware/errorHandler';
import type { CreateWalletInput } from '../validators/wallet.validators';

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
