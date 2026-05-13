import { z } from 'zod';

const HEX_COLOR = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'color must be a valid hex color')
  .optional();

export const createWalletSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['CASH', 'INVESTMENT']).optional(),
  initial_balance: z.number().optional(),
  icon: z.string().max(50).optional(),
  color: HEX_COLOR,
});

export const updateWalletSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().max(50).optional(),
  color: HEX_COLOR,
});

export type CreateWalletInput = z.infer<typeof createWalletSchema>;
export type UpdateWalletInput = z.infer<typeof updateWalletSchema>;
