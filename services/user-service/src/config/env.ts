import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),
  RABBITMQ_URL: z.string().min(1, 'RABBITMQ_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  INTERNAL_SECRET: z.string().min(32, 'INTERNAL_SECRET must be at least 32 characters'),
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  APPLE_TEAM_ID: z.string().min(1, 'APPLE_TEAM_ID is required'),
  APPLE_SIGN_IN_KEY_ID: z.string().min(1, 'APPLE_SIGN_IN_KEY_ID is required'),
  APPLE_SIGN_IN_CLIENT_ID: z.string().min(1, 'APPLE_SIGN_IN_CLIENT_ID is required'),
  GOOGLE_IOS_CLIENT_ID: z.string().min(1, 'GOOGLE_IOS_CLIENT_ID is required'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:');
  // eslint-disable-next-line no-console
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
