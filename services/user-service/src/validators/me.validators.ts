import { z } from 'zod';

export const patchMeSchema = z.object({
  name: z.string().min(1).optional(),
  timezone: z
    .string()
    .refine((tz) => Intl.supportedValuesOf('timeZone').includes(tz), {
      message: 'Invalid IANA timezone',
    })
    .optional(),
  default_currency: z.string().length(3).optional(),
  reminder_enabled: z.boolean().optional(),
  high_spend_enabled: z.boolean().optional(),
  high_spend_threshold: z.number().positive().optional(),
});

export type PatchMeInput = z.infer<typeof patchMeSchema>;
