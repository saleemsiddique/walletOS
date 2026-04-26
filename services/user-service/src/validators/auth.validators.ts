import { z } from 'zod';

const validTimezone = z
  .string()
  .refine((tz) => Intl.supportedValuesOf('timeZone').includes(tz), {
    message: 'Invalid IANA timezone',
  });

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  timezone: validTimezone.optional(),
  default_currency: z.string().length(3).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const appleSchema = z.object({
  identity_token: z.string().min(1, 'identity_token is required'),
  name: z.string().min(1).optional(),
});

export const googleSchema = z.object({
  id_token: z.string().min(1, 'id_token is required'),
  name: z.string().min(1).optional(),
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(1, 'refresh_token is required'),
});

export const logoutSchema = z.object({
  refresh_token: z.string().min(1, 'refresh_token is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'token is required'),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AppleInput = z.infer<typeof appleSchema>;
export type GoogleInput = z.infer<typeof googleSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
