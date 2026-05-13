import { z } from 'zod';

export const createTransferSchema = z
  .object({
    from_wallet_id: z.string().uuid(),
    to_wallet_id: z.string().uuid(),
    amount: z.number().positive('amount must be greater than 0'),
    note: z.string().max(500).optional(),
    date: z.string().date().optional(),
  })
  .refine((data) => data.from_wallet_id !== data.to_wallet_id, {
    message: 'from_wallet_id and to_wallet_id must be different',
    path: ['to_wallet_id'],
  });

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
