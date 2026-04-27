import { prisma } from '../lib/prisma';
import { publishEvent } from '../lib/rabbitmq';
import { NotFoundError } from '../middleware/errorHandler';
import type { PatchMeInput } from '../validators/me.validators';
import type { User } from '@prisma/client';

type MeResponse = {
  id: string;
  email: string;
  name: string;
  timezone: string;
  default_currency: string;
  has_password: boolean;
  apple_linked: boolean;
  google_linked: boolean;
  reminder_enabled: boolean;
  high_spend_enabled: boolean;
  high_spend_threshold: number;
  created_at: Date;
};

function toMeResponse(user: User): MeResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    timezone: user.timezone,
    default_currency: user.default_currency,
    has_password: user.password_hash !== null,
    apple_linked: user.apple_id !== null,
    google_linked: user.google_id !== null,
    reminder_enabled: user.reminder_enabled,
    high_spend_enabled: user.high_spend_enabled,
    high_spend_threshold: user.high_spend_threshold.toNumber(),
    created_at: user.created_at,
  };
}

export async function getMe(userId: string): Promise<MeResponse> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return toMeResponse(user);
}

export async function patchMe(userId: string, input: PatchMeInput): Promise<MeResponse> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.timezone !== undefined && { timezone: input.timezone }),
      ...(input.default_currency !== undefined && { default_currency: input.default_currency }),
      ...(input.reminder_enabled !== undefined && { reminder_enabled: input.reminder_enabled }),
      ...(input.high_spend_enabled !== undefined && { high_spend_enabled: input.high_spend_enabled }),
      ...(input.high_spend_threshold !== undefined && { high_spend_threshold: input.high_spend_threshold }),
    },
  });
  return toMeResponse(user);
}

export async function deleteMe(userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } });
  publishEvent('user.deleted', { user_id: userId });
}

type InternalUserResponse = Omit<MeResponse, 'created_at'>;

function toInternalUserResponse(user: User): InternalUserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    timezone: user.timezone,
    default_currency: user.default_currency,
    has_password: user.password_hash !== null,
    apple_linked: user.apple_id !== null,
    google_linked: user.google_id !== null,
    reminder_enabled: user.reminder_enabled,
    high_spend_enabled: user.high_spend_enabled,
    high_spend_threshold: user.high_spend_threshold.toNumber(),
  };
}

export async function getInternalUser(id: string): Promise<InternalUserResponse> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError('User not found');
  return toInternalUserResponse(user);
}

export async function listInternalUsers(filters: {
  timezone?: string;
  reminder_enabled?: boolean;
}): Promise<{ users: InternalUserResponse[]; total: number }> {
  const users = await prisma.user.findMany({
    where: {
      ...(filters.timezone !== undefined && { timezone: filters.timezone }),
      ...(filters.reminder_enabled !== undefined && { reminder_enabled: filters.reminder_enabled }),
    },
  });
  return { users: users.map(toInternalUserResponse), total: users.length };
}
