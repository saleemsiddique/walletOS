import { startUserDeletedConsumer } from './userDeleted';
import { startTransactionCreatedConsumer } from './transactionCreated';

export async function startAllConsumers(): Promise<void> {
  await startUserDeletedConsumer();
  await startTransactionCreatedConsumer();
}
