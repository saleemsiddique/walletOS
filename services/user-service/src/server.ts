import { createApp } from './app';
import { env } from './config/env';
import { connectRabbitMQ } from './lib/rabbitmq';

async function start(): Promise<void> {
  await connectRabbitMQ();
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[user-service] listening on port ${env.PORT} (${env.NODE_ENV})`);
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
  console.error('[user-service] startup failed:', err);
  process.exit(1);
});
