import { prisma } from '../lib/prisma';
import type { CreateDeviceInput } from '../validators/device.validators';

export async function upsertDevice(userId: string, input: CreateDeviceInput) {
  return prisma.deviceToken.upsert({
    where: { token: input.token },
    update: { user_id: userId },
    create: { user_id: userId, token: input.token, platform: input.platform },
  });
}

export async function removeDevice(token: string): Promise<void> {
  await prisma.deviceToken.deleteMany({ where: { token } });
}
