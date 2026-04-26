// Variables de entorno al nivel de módulo — se ejecutan ANTES de que
// cualquier import en los archivos de test evalúe env.ts.
// Moverlas dentro de beforeAll() llegaría tarde: env.ts ya se habría ejecutado.

process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3099';

// CI inyecta estas tres; ??= las respeta si ya existen
process.env['DATABASE_URL'] ??= 'postgresql://walletos:test@localhost:5432/walletos_users';
process.env['REDIS_URL'] ??= 'redis://localhost:6379';
process.env['RABBITMQ_URL'] ??= 'amqp://walletos:test@localhost:5672';

// CI no inyecta estas; ||= sobreescribe también strings vacíos que .env carga con valores en blanco
process.env['JWT_SECRET'] ||= 'test-jwt-secret-minimum-32-characters-long!!';
process.env['INTERNAL_SECRET'] ||= 'test-internal-secret-minimum-32-chars!!';
process.env['RESEND_API_KEY'] ||= 're_test_placeholder';
process.env['APPLE_TEAM_ID'] ||= 'TESTTEAMID1';
process.env['APPLE_SIGN_IN_KEY_ID'] ||= 'TESTKEYID1';
process.env['APPLE_SIGN_IN_CLIENT_ID'] ||= 'com.walletOS.app';
process.env['GOOGLE_IOS_CLIENT_ID'] ||= 'test.apps.googleusercontent.com';

import { prisma } from '../lib/prisma';
import { closeRedis } from '../lib/redis';

beforeAll(async () => {
  await prisma.$connect();
});

afterEach(async () => {
  await prisma.passwordResetToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
  await closeRedis();
});
