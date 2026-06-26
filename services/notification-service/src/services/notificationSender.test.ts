import { vi, beforeEach, describe, it, expect } from 'vitest';
import { sendNotification } from './notificationSender';

vi.mock('../lib/prisma', () => ({
  prisma: {
    deviceToken: {
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../lib/apns', () => ({
  sendPush: vi.fn(),
}));

import { prisma } from '../lib/prisma';
import { sendPush } from '../lib/apns';

const mockFindMany = vi.mocked(prisma.deviceToken.findMany);
const mockDelete = vi.mocked(prisma.deviceToken.delete);
const mockCreate = vi.mocked(prisma.notification.create);
const mockSendPush = vi.mocked(sendPush);

const USER_ID = 'user-0000-0000-0000-000000000001';
const INPUT = { type: 'reminder', title: 'Recordatorio', body: '¿Has anotado tus gastos?' };

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue({} as never);
  mockDelete.mockResolvedValue({} as never);
});

describe('sendNotification', () => {
  it('persists notification even when user has no device tokens', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    await sendNotification(USER_ID, INPUT);

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ user_id: USER_ID, type: 'reminder', status: 'sent' }),
    });
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('sends push to all registered tokens', async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: 'tok-1', user_id: USER_ID, token: 'apns-token-1', platform: 'ios', created_at: new Date() },
      { id: 'tok-2', user_id: USER_ID, token: 'apns-token-2', platform: 'ios', created_at: new Date() },
    ]);
    mockSendPush.mockResolvedValue('sent');

    await sendNotification(USER_ID, INPUT);

    expect(mockSendPush).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'sent' }),
    });
  });

  it('deletes token and continues when APNs returns invalid_token', async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: 'tok-expired', user_id: USER_ID, token: 'expired-token', platform: 'ios', created_at: new Date() },
      { id: 'tok-valid', user_id: USER_ID, token: 'valid-token', platform: 'ios', created_at: new Date() },
    ]);
    mockSendPush
      .mockResolvedValueOnce('invalid_token')
      .mockResolvedValueOnce('sent');

    await sendNotification(USER_ID, INPUT);

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'tok-expired' } });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'sent' }),
    });
  });

  it('persists with status "failed" when all tokens fail', async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: 'tok-1', user_id: USER_ID, token: 'token-1', platform: 'ios', created_at: new Date() },
    ]);
    mockSendPush.mockResolvedValueOnce('failed');

    await sendNotification(USER_ID, INPUT);

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'failed' }),
    });
  });
});
