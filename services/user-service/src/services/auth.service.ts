import { prisma } from '../lib/prisma';
import { signAccessToken } from '../lib/jwt';
import { generateOpaqueToken, hashToken } from '../lib/token';
import { hashPassword, comparePassword } from '../lib/hash';
import { ConflictError, UnauthorizedError, ValidationError } from '../middleware/errorHandler';
import type { User } from '@prisma/client';
import type { RegisterInput, LoginInput, RefreshInput, LogoutInput, AppleInput, GoogleInput } from '../validators/auth.validators';
import appleSignin from 'apple-signin-auth';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type PublicUser = {
  id: string;
  email: string;
  name: string;
  timezone: string;
  default_currency: string;
  reminder_enabled: boolean;
  high_spend_enabled: boolean;
  high_spend_threshold: number;
  created_at: Date;
};

export type AuthResponse = {
  user: PublicUser;
  access_token: string;
  refresh_token: string;
};

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    timezone: user.timezone,
    default_currency: user.default_currency,
    reminder_enabled: user.reminder_enabled,
    high_spend_enabled: user.high_spend_enabled,
    high_spend_threshold: user.high_spend_threshold.toNumber(),
    created_at: user.created_at,
  };
}

async function issueTokens(userId: string): Promise<{ access_token: string; refresh_token: string }> {
  const access_token = signAccessToken({ userId });
  const refresh_token = generateOpaqueToken();
  await prisma.refreshToken.create({
    data: {
      user_id: userId,
      token_hash: hashToken(refresh_token),
      expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return { access_token, refresh_token };
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError('Email already registered');

  const password_hash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password_hash,
      name: input.name,
      ...(input.timezone !== undefined && { timezone: input.timezone }),
      ...(input.default_currency !== undefined && { default_currency: input.default_currency }),
    },
  });

  const tokens = await issueTokens(user.id);
  return { user: toPublicUser(user), ...tokens };
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user || !user.password_hash) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const valid = await comparePassword(input.password, user.password_hash);
  if (!valid) throw new UnauthorizedError('Invalid credentials');

  const tokens = await issueTokens(user.id);
  return { user: toPublicUser(user), ...tokens };
}

export async function refresh(input: RefreshInput): Promise<{ access_token: string; refresh_token: string }> {
  const tokenHash = hashToken(input.refresh_token);

  const record = await prisma.refreshToken.findUnique({ where: { token_hash: tokenHash } });
  if (!record) throw new UnauthorizedError('Invalid refresh token');

  if (record.expires_at < new Date()) {
    await prisma.refreshToken.delete({ where: { id: record.id } });
    throw new UnauthorizedError('Refresh token expired');
  }

  const newRefreshToken = generateOpaqueToken();

  await prisma.$transaction([
    prisma.refreshToken.delete({ where: { id: record.id } }),
    prisma.refreshToken.create({
      data: {
        user_id: record.user_id,
        token_hash: hashToken(newRefreshToken),
        expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    }),
  ]);

  const access_token = signAccessToken({ userId: record.user_id });
  return { access_token, refresh_token: newRefreshToken };
}

export async function logout(input: LogoutInput): Promise<void> {
  await prisma.refreshToken.deleteMany({
    where: { token_hash: hashToken(input.refresh_token) },
  });
}

export async function loginWithApple(input: AppleInput): Promise<AuthResponse> {
  let appleId: string;
  let appleEmail: string | undefined;

  try {
    const payload = await appleSignin.verifyIdToken(input.identity_token, {
      audience: env.APPLE_SIGN_IN_CLIENT_ID,
      ignoreExpiration: false,
    });
    appleId = payload.sub;
    appleEmail = payload.email;
  } catch {
    throw new UnauthorizedError('Invalid Apple identity token');
  }

  let user = await prisma.user.findUnique({ where: { apple_id: appleId } });

  if (!user) {
    if (!appleEmail) {
      throw new UnauthorizedError('Re-authenticate with Apple to complete sign-in');
    }
    if (!input.name) {
      throw new ValidationError('name is required for first-time Apple sign-in');
    }
    user = await prisma.user.create({
      data: { email: appleEmail, apple_id: appleId, name: input.name },
    });
  }

  const tokens = await issueTokens(user.id);
  return { user: toPublicUser(user), ...tokens };
}

export async function loginWithGoogle(input: GoogleInput): Promise<AuthResponse> {
  let googleId: string;
  let email: string;
  let nameFromToken: string | undefined;

  try {
    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({
      idToken: input.id_token,
      audience: env.GOOGLE_IOS_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedError('Invalid Google token payload');
    }
    googleId = payload.sub;
    email = payload.email;
    nameFromToken = payload.name;
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Invalid Google ID token');
  }

  let user = await prisma.user.findUnique({ where: { google_id: googleId } });

  if (!user) {
    const name = input.name ?? nameFromToken;
    if (!name) throw new ValidationError('name is required for first-time Google sign-in');
    user = await prisma.user.create({
      data: { email, google_id: googleId, name },
    });
  }

  const tokens = await issueTokens(user.id);
  return { user: toPublicUser(user), ...tokens };
}
