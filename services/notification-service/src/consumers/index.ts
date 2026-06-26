import { startUserDeletedConsumer } from './userDeleted';
import { startTransactionCreatedConsumer } from './transactionCreated';
import { startInsightGeneratedConsumer } from './insightGenerated';

export async function startAllConsumers(): Promise<void> {
  await startUserDeletedConsumer();
  await startTransactionCreatedConsumer();
  await startInsightGeneratedConsumer();
}
