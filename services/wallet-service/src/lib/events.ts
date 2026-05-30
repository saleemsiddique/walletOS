import { publishEvent } from './rabbitmq';

export type TransactionCreatedData = {
  user_id: string;
  transaction_id: string;
  wallet_id: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category_id: string | null;
  category_name: string | null;
  date: string;
  transfer_id: string | null;
};

export function publishTransactionCreated(data: TransactionCreatedData): void {
  publishEvent('transaction.created', {
    event: 'transaction.created',
    timestamp: new Date().toISOString(),
    data,
  });
}
