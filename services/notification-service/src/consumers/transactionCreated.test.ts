import { vi } from 'vitest';

vi.mock('../lib/rabbitmq', () => ({ subscribe: vi.fn() }));
vi.mock('../lib/redis', () => ({ getRedis: vi.fn() }));
vi.mock('../lib/userClient', () => ({ getUserById: vi.fn() }));
vi.mock('../services/notificationSender', () => ({ sendNotification: vi.fn() }));

import { getRedis } from '../lib/redis';
import { getUserById } from '../lib/userClient';
import { sendNotification } from '../services/notificationSender';
import { handleTransactionCreated } from './transactionCreated';

const mockSet = vi.fn().mockResolvedValue('OK');
vi.mocked(getRedis).mockReturnValue({ set: mockSet } as never);

const mockGetUser = vi.mocked(getUserById);
const mockSend = vi.mocked(sendNotification);

const USER_A = 'a0000000-0000-0000-0000-000000000001';

function makePayload(overrides: Partial<{ type: string; amount: number; category_name: string | null }> = {}) {
  return {
    event: 'transaction.created',
    data: {
      user_id: USER_A,
      type: 'EXPENSE',
      amount: 200,
      category_name: 'Restaurantes',
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getRedis).mockReturnValue({ set: mockSet } as never);
});

describe('handleTransactionCreated', () => {
  it('sets the activity Redis key for any transaction type', async () => {
    mockGetUser.mockResolvedValueOnce({
      id: USER_A, timezone: 'UTC', reminder_enabled: true,
      high_spend_enabled: false, high_spend_threshold: 100,
    });

    await handleTransactionCreated(makePayload({ type: 'INCOME' }));

    expect(mockSet).toHaveBeenCalledWith(
      expect.stringMatching(/^activity:/),
      '1',
      'EX',
      93600,
    );
  });

  it('does not send notification for INCOME transactions', async () => {
    await handleTransactionCreated(makePayload({ type: 'INCOME' }));
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sends high_spend notification when enabled and amount exceeds threshold', async () => {
    mockGetUser.mockResolvedValueOnce({
      id: USER_A, timezone: 'UTC', reminder_enabled: true,
      high_spend_enabled: true, high_spend_threshold: 100,
    });
    mockSend.mockResolvedValueOnce(undefined);

    await handleTransactionCreated(makePayload({ amount: 200, category_name: 'Restaurantes' }));

    expect(mockSend).toHaveBeenCalledWith(USER_A, expect.objectContaining({
      type: 'high_spend',
      body: expect.stringContaining('200€'),
    }));
  });

  it('does not send notification when amount is below threshold', async () => {
    mockGetUser.mockResolvedValueOnce({
      id: USER_A, timezone: 'UTC', reminder_enabled: true,
      high_spend_enabled: true, high_spend_threshold: 500,
    });

    await handleTransactionCreated(makePayload({ amount: 50 }));

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('does not send notification when high_spend_enabled is false', async () => {
    mockGetUser.mockResolvedValueOnce({
      id: USER_A, timezone: 'UTC', reminder_enabled: true,
      high_spend_enabled: false, high_spend_threshold: 100,
    });

    await handleTransactionCreated(makePayload({ amount: 500 }));

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('throws on invalid payload', async () => {
    await expect(handleTransactionCreated(null)).rejects.toThrow();
    await expect(handleTransactionCreated({ data: { user_id: '' } })).rejects.toThrow();
    await expect(handleTransactionCreated({ data: { user_id: USER_A, type: 'INVALID', amount: 10 } })).rejects.toThrow();
  });
});
