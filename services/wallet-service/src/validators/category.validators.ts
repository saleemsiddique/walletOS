import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().min(1).max(50),
  type: z.enum(['INCOME', 'EXPENSE']),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().min(1).max(50).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
