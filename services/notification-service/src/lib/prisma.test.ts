import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from './prisma';

const userId = '11111111-1111-1111-1111-111111111111';

beforeAll(async () => {
  await prisma.$connect();
});

afterEach(async () => {
  await prisma.notification.deleteMany();
  await prisma.deviceToken.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('device_tokens', () => {
  it('persiste y recupera un device token con sus defaults', async () => {
    const created = await prisma.deviceToken.create({
      data: { user_id: userId, token: 'apns-token-1' },
    });

    expect(created.id).toBeDefined();
    expect(created.platform).toBe('ios');
    expect(created.created_at).toBeInstanceOf(Date);

    const found = await prisma.deviceToken.findUnique({ where: { token: 'apns-token-1' } });
    expect(found?.user_id).toBe(userId);
  });

  it('rechaza dos tokens con el mismo valor por la restricción UNIQUE', async () => {
    await prisma.deviceToken.create({ data: { user_id: userId, token: 'dup-token' } });

    await expect(
      prisma.deviceToken.create({ data: { user_id: userId, token: 'dup-token' } }),
    ).rejects.toThrow();
  });
});

describe('notifications', () => {
  it('persiste una notificación con status por defecto y read_at nulo', async () => {
    const created = await prisma.notification.create({
      data: { user_id: userId, type: 'reminder', title: 'Recordatorio', body: '¿Anotaste tus gastos?' },
    });

    expect(created.status).toBe('sent');
    expect(created.read_at).toBeNull();

    const found = await prisma.notification.findUnique({ where: { id: created.id } });
    expect(found?.title).toBe('Recordatorio');
    expect(found?.body).toBe('¿Anotaste tus gastos?');
  });
});
