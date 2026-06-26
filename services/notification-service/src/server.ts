import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { connectRabbitMQ } from './lib/rabbitmq';
import { startAllConsumers } from './consumers/index';

async function start(): Promise<void> {
  await connectRabbitMQ();
  await startAllConsumers();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`[notification-service] listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  process.on('SIGTERM', () => server.close(() => process.exit(0)));
  process.on('SIGINT', () => server.close(() => process.exit(0)));
}

start().catch((err) => {
  logger.error({ err }, '[notification-service] startup failed');
  process.exit(1);
});
