import { z } from 'zod';

export const createDeviceSchema = z.object({
  token: z.string().min(1).max(500),
  platform: z.enum(['ios']).optional().default('ios'),
});

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
