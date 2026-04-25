import { prisma } from '../lib/prisma';

const baseUser = {
  email: 'test@example.com',
  name: 'Test User',
};

describe('User model', () => {
  it('saves with correct default values', async () => {
    const user = await prisma.user.create({ data: baseUser });

    expect(user.timezone).toBe('UTC');
    expect(user.default_currency).toBe('EUR');
    expect(user.reminder_enabled).toBe(true);
    expect(user.high_spend_enabled).toBe(false);
    expect(Number(user.high_spend_threshold)).toBe(100);
  });

  it('rejects duplicate email', async () => {
    await prisma.user.create({ data: baseUser });

    await expect(
      prisma.user.create({ data: { email: baseUser.email, name: 'Other' } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('cascades delete to refresh_tokens and password_reset_tokens', async () => {
    const user = await prisma.user.create({ data: baseUser });
    const future = new Date(Date.now() + 60_000);

    await prisma.refreshToken.create({
      data: { user_id: user.id, token_hash: 'hash-rt-1', expires_at: future },
    });
    await prisma.passwordResetToken.create({
      data: { user_id: user.id, token_hash: 'hash-prt-1', expires_at: future },
    });

    await prisma.user.delete({ where: { id: user.id } });

    const refreshTokens = await prisma.refreshToken.findMany({ where: { user_id: user.id } });
    const resetTokens = await prisma.passwordResetToken.findMany({ where: { user_id: user.id } });

    expect(refreshTokens).toHaveLength(0);
    expect(resetTokens).toHaveLength(0);
  });
});

describe('RefreshToken model', () => {
  it('rejects duplicate token_hash', async () => {
    const user = await prisma.user.create({ data: baseUser });
    const future = new Date(Date.now() + 60_000);
    const sharedHash = 'duplicate-hash';

    await prisma.refreshToken.create({
      data: { user_id: user.id, token_hash: sharedHash, expires_at: future },
    });

    await expect(
      prisma.refreshToken.create({
        data: { user_id: user.id, token_hash: sharedHash, expires_at: future },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
