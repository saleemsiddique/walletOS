import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-minimum-32-characters-long!!';

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
}

type WalletItem = {
  id: string;
  bank_id: string;
  name: string;
  icon: string;
  color: string;
  balance: number;
  is_archived: boolean;
};

const USER_A = 'a0000000-0000-0000-0000-000000000001';
const USER_B = 'b0000000-0000-0000-0000-000000000002';
const VALID_UUID = '00000000-0000-0000-0000-000000000abc';

describe('POST /banks/:id/wallets', () => {
  it('401 without token', async () => {
    const res = await request(createApp())
      .post(`/banks/${VALID_UUID}/wallets`)
      .send({ name: 'Ahorro' });
    expect(res.status).toBe(401);
  });

  it('201 creates wallet with initial_balance and balance equals initial_balance', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'Santander' } });

    const res = await request(createApp())
      .post(`/banks/${bank.id}/wallets`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'Ahorro', initial_balance: 1200, icon: '💰', color: '#34C759' });

    expect(res.status).toBe(201);
    const body = res.body as WalletItem;
    expect(body).toMatchObject({
      bank_id: bank.id,
      name: 'Ahorro',
      icon: '💰',
      color: '#34C759',
      balance: 1200,
      is_archived: false,
    });
  });

  it('201 applies defaults icon=💳 color=#007AFF initial_balance=0 when omitted', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'BBVA' } });

    const res = await request(createApp())
      .post(`/banks/${bank.id}/wallets`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'Cuenta' });

    expect(res.status).toBe(201);
    const body = res.body as WalletItem;
    expect(body).toMatchObject({ name: 'Cuenta', icon: '💳', color: '#007AFF', balance: 0 });
  });

  it('404 with non-existing bank_id', async () => {
    const res = await request(createApp())
      .post(`/banks/${VALID_UUID}/wallets`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'X' });

    expect(res.status).toBe(404);
  });

  it('404 with bank of another user', async () => {
    const otro = await prisma.bank.create({ data: { user_id: USER_B, name: 'OtroBanco' } });

    const res = await request(createApp())
      .post(`/banks/${otro.id}/wallets`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'Robado' });

    expect(res.status).toBe(404);
  });
});

describe('GET /banks/:id/wallets', () => {
  it('401 without token', async () => {
    const res = await request(createApp()).get(`/banks/${VALID_UUID}/wallets`);
    expect(res.status).toBe(401);
  });

  it('200 lists active wallets of the bank with computed balance', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'Santander' } });
    const wallet = await prisma.wallet.create({
      data: {
        user_id: USER_A,
        bank_id: bank.id,
        name: 'Ahorro',
        initial_balance: '1000.00',
      },
    });
    await prisma.transaction.createMany({
      data: [
        {
          user_id: USER_A,
          wallet_id: wallet.id,
          type: 'INCOME',
          amount: '500.00',
          date: new Date('2026-05-10'),
        },
        {
          user_id: USER_A,
          wallet_id: wallet.id,
          type: 'EXPENSE',
          amount: '200.00',
          date: new Date('2026-05-12'),
        },
      ],
    });

    const res = await request(createApp())
      .get(`/banks/${bank.id}/wallets`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as { wallets: WalletItem[] };

    expect(res.status).toBe(200);
    expect(body.wallets).toHaveLength(1);
    expect(body.wallets[0]).toMatchObject({ name: 'Ahorro', balance: 1300 });
  });

  it('does not include archived wallets', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'BBVA' } });
    await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'Activa', initial_balance: '100.00' },
    });
    await prisma.wallet.create({
      data: {
        user_id: USER_A,
        bank_id: bank.id,
        name: 'Archivada',
        initial_balance: '900.00',
        is_archived: true,
      },
    });

    const res = await request(createApp())
      .get(`/banks/${bank.id}/wallets`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as { wallets: WalletItem[] };

    expect(body.wallets).toHaveLength(1);
    expect(body.wallets[0]?.name).toBe('Activa');
  });

  it('404 with bank of another user', async () => {
    const otro = await prisma.bank.create({ data: { user_id: USER_B, name: 'OtroBanco' } });

    const res = await request(createApp())
      .get(`/banks/${otro.id}/wallets`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /wallets', () => {
  it('401 without token', async () => {
    const res = await request(createApp()).get('/wallets');
    expect(res.status).toBe(401);
  });

  it('200 lists all active wallets of user with bank_name', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'Santander' } });
    await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'Ahorro', initial_balance: '500.00' },
    });
    await prisma.wallet.create({
      data: {
        user_id: USER_A,
        bank_id: bank.id,
        name: 'Archivada',
        initial_balance: '999.00',
        is_archived: true,
      },
    });

    const res = await request(createApp())
      .get('/wallets')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as { wallets: (WalletItem & { bank_name: string })[] };

    expect(res.status).toBe(200);
    expect(body.wallets).toHaveLength(1);
    expect(body.wallets[0]).toMatchObject({
      name: 'Ahorro',
      bank_name: 'Santander',
      balance: 500,
    });
  });

  it('does not return wallets of other users', async () => {
    const otroBank = await prisma.bank.create({ data: { user_id: USER_B, name: 'OtroBanco' } });
    await prisma.wallet.create({
      data: { user_id: USER_B, bank_id: otroBank.id, name: 'NoMia' },
    });

    const res = await request(createApp())
      .get('/wallets')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as { wallets: WalletItem[] };

    expect(body.wallets).toHaveLength(0);
  });
});

describe('PATCH /wallets/:id', () => {
  it('401 without token', async () => {
    const res = await request(createApp()).patch(`/wallets/${VALID_UUID}`).send({ name: 'X' });
    expect(res.status).toBe(401);
  });

  it('200 updates name, icon and color', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'Santander' } });
    const wallet = await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'Ahorro', initial_balance: '100.00' },
    });

    const res = await request(createApp())
      .patch(`/wallets/${wallet.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'Cuenta ahorro', icon: '🏦', color: '#FF9500' });

    expect(res.status).toBe(200);
    const body = res.body as WalletItem;
    expect(body).toMatchObject({
      id: wallet.id,
      name: 'Cuenta ahorro',
      icon: '🏦',
      color: '#FF9500',
      balance: 100,
    });
  });

  it('ignores initial_balance if sent in body', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'Santander' } });
    const wallet = await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'Ahorro', initial_balance: '100.00' },
    });

    const res = await request(createApp())
      .patch(`/wallets/${wallet.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'X', initial_balance: 9999 });

    expect(res.status).toBe(200);
    const body = res.body as WalletItem;
    expect(body.balance).toBe(100);

    const dbWallet = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    expect(dbWallet.initial_balance.toString()).toBe('100');
  });

  it('404 with non-existing id', async () => {
    const res = await request(createApp())
      .patch(`/wallets/${VALID_UUID}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'X' });

    expect(res.status).toBe(404);
  });

  it('404 with wallet of another user', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_B, name: 'OtroBanco' } });
    const ajeno = await prisma.wallet.create({
      data: { user_id: USER_B, bank_id: bank.id, name: 'Ajeno' },
    });

    const res = await request(createApp())
      .patch(`/wallets/${ajeno.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ name: 'Robado' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /wallets/:id', () => {
  it('401 without token', async () => {
    const res = await request(createApp()).delete(`/wallets/${VALID_UUID}`);
    expect(res.status).toBe(401);
  });

  it('200 archives wallet and preserves transactions', async () => {
    const bank = await prisma.bank.create({ data: { user_id: USER_A, name: 'Santander' } });
    const wallet = await prisma.wallet.create({
      data: { user_id: USER_A, bank_id: bank.id, name: 'Ahorro', initial_balance: '100.00' },
    });
    const tx = await prisma.transaction.create({
      data: {
        user_id: USER_A,
        wallet_id: wallet.id,
        type: 'INCOME',
        amount: '50.00',
        date: new Date('2026-05-10'),
      },
    });

    const res = await request(createApp())
      .delete(`/wallets/${wallet.id}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(200);
    const body = res.body as WalletItem;
    expect(body).toMatchObject({ id: wallet.id, name: 'Ahorro', is_archived: true });

    const dbWallet = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    expect(dbWallet.is_archived).toBe(true);

    const dbTx = await prisma.transaction.findUnique({ where: { id: tx.id } });
    expect(dbTx).not.toBeNull();
  });

  it('404 with non-existing id', async () => {
    const res = await request(createApp())
      .delete(`/wallets/${VALID_UUID}`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`);

    expect(res.status).toBe(404);
  });
});
