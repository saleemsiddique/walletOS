import { createApp } from './app';
import { env } from './config/env';
import { connectRabbitMQ } from './lib/rabbitmq';
import { seedCategories } from './lib/seed';
import { scheduleRecurringJob } from './jobs/recurring.job';

async function start(): Promise<void> {
  await connectRabbitMQ();
  await seedCategories();
  scheduleRecurringJob();
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[wallet-service] listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    server.close(() => process.exit(0));
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[wallet-service] startup failed:', err);
  process.exit(1);
});
