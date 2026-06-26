import { vi } from 'vitest';

vi.mock('../lib/rabbitmq', () => ({
  subscribe: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    deviceToken: { deleteMany: vi.fn() },
    notification: { deleteMany: vi.fn() },
  },
}));

import { prisma } from '../lib/prisma';
import { handleUserDeleted } from './userDeleted';

const mockTransaction = vi.mocked(prisma.$transaction);

const USER_A = 'a0000000-0000-0000-0000-000000000001';

beforeEach(() => {
  vi.clearAllMocks();
  mockTransaction.mockResolvedValue([]);
});

describe('handleUserDeleted', () => {
  it('deletes device_tokens and notifications in a transaction', async () => {
    await handleUserDeleted({ user_id: USER_A });
    expect(mockTransaction).toHaveBeenCalledOnce();
  });

  it('is idempotent — second call does not throw', async () => {
    await expect(handleUserDeleted({ user_id: USER_A })).resolves.not.toThrow();
    await expect(handleUserDeleted({ user_id: USER_A })).resolves.not.toThrow();
  });

  it('throws on missing user_id', async () => {
    await expect(handleUserDeleted({})).rejects.toThrow();
    await expect(handleUserDeleted({ user_id: '' })).rejects.toThrow();
    await expect(handleUserDeleted(null)).rejects.toThrow();
  });
});
