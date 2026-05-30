import type { Bank } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { CreateBankInput } from '../validators/bank.validators';

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
