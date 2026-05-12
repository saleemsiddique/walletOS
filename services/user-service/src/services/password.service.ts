import { prisma } from '../lib/prisma';
import { generateOpaqueToken, hashToken } from '../lib/token';
import { hashPassword } from '../lib/hash';
import { sendPasswordResetEmail } from '../lib/email';
import { ValidationError } from '../middleware/errorHandler';
import type { ForgotPasswordInput, ResetPasswordInput } from '../validators/auth.validators';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export async function forgotPassword(input: ForgotPasswordInput): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) return;

  const token = generateOpaqueToken();
  await prisma.passwordResetToken.create({
    data: {
      user_id: user.id,
      token_hash: hashToken(token),
      expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  await sendPasswordResetEmail(user.email, token);
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const tokenHash = hashToken(input.token);
  const record = await prisma.passwordResetToken.findUnique({ where: { token_hash: tokenHash } });

  if (!record) throw new ValidationError('Invalid or expired token');
  if (record.used_at !== null) throw new ValidationError('Token already used');
  if (record.expires_at < new Date()) throw new ValidationError('Token expired');

  const password_hash = await hashPassword(input.new_password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.user_id },
      data: { password_hash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { used_at: new Date() },
    }),
    prisma.refreshToken.deleteMany({
      where: { user_id: record.user_id },
    }),
  ]);
}
