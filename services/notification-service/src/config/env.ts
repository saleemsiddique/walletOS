import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3004),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),
  RABBITMQ_URL: z.string().min(1, 'RABBITMQ_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  INTERNAL_SECRET: z.string().min(32, 'INTERNAL_SECRET must be at least 32 characters'),
  USER_SERVICE_URL: z.string().url('USER_SERVICE_URL must be a valid URL'),
  // Either a filesystem path to the .p8 file or the raw key content (for containers)
  APNS_KEY_PATH: z.string().optional(),
  APNS_KEY: z.string().optional(),
  APNS_KEY_ID: z.string().min(1, 'APNS_KEY_ID is required'),
  APNS_TEAM_ID: z.string().min(1, 'APNS_TEAM_ID is required'),
  APNS_BUNDLE_ID: z.string().min(1, 'APNS_BUNDLE_ID is required'),
  APNS_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
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
