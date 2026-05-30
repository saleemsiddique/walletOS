import { vi } from 'vitest';

vi.mock('../lib/rabbitmq', () => ({
  connectRabbitMQ: vi.fn(),
  publishEvent: vi.fn(),
}));

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { seedCategories } from '../lib/seed';
import { publishEvent } from '../lib/rabbitmq';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-minimum-32-characters-long!!';

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
}

type TransactionItem = {
  id: string;
  wallet_id: string;
  wallet_name: string;
  bank_name: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: { id: string; name: string; icon: string } | null;
  note: string | null;
  date: string;
  transfer_id: string | null;
  paired_wallet_name: string | null;
  created_at: string;
};

const USER_A = 'a0000000-0000-0000-0000-000000000001';
const USER_B = 'b0000000-0000-0000-0000-000000000002';
const VALID_UUID = '00000000-0000-0000-0000-000000000abc';

async function makeWallet(userId: string): Promise<{ id: string; bankId: string }> {
  const bank = await prisma.bank.create({ data: { user_id: userId, name: 'Santander' } });
  const wallet = await prisma.wallet.create({
    data: { user_id: userId, bank_id: bank.id, name: 'Ahorro', initial_balance: '0.00' },
  });
  return { id: wallet.id, bankId: bank.id };
}

describe('POST /wallets/:id/transactions', () => {
  beforeEach(async () => {
    await seedCategories();
    vi.mocked(publishEvent).mockClear();
  });

  it('401 without token', async () => {
    const res = await request(createApp())
      .post(`/wallets/${VALID_UUID}/transactions`)
      .send({ type: 'EXPENSE', amount: 10 });
    expect(res.status).toBe(401);
  });

  it('201 creates EXPENSE with server-generated id and publishes event', async () => {
    const { id: walletId, bankId } = await makeWallet(USER_A);
    const category = await prisma.category.findFirstOrThrow({
      where: { user_id: null, name: 'Comida', type: 'EXPENSE' },
    });

    const res = await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({
        type: 'EXPENSE',
        amount: 42.3,
        category_id: category.id,
        note: 'Mercadona',
        date: '2026-04-18',
      });

    expect(res.status).toBe(201);
    const body = res.body as TransactionItem;
    expect(body).toMatchObject({
      wallet_id: walletId,
      wallet_name: 'Ahorro',
      bank_name: 'Santander',
      type: 'EXPENSE',
      amount: 42.3,
      note: 'Mercadona',
      date: '2026-04-18',
      transfer_id: null,
      paired_wallet_name: null,
    });
    expect(body.category).toMatchObject({ id: category.id, name: 'Comida' });
    expect(typeof body.id).toBe('string');
    expect(bankId).toBeTruthy();

    expect(publishEvent).toHaveBeenCalledOnce();
    const [routingKey, payload] = vi.mocked(publishEvent).mock.calls[0] ?? [];
    expect(routingKey).toBe('transaction.created');
    expect(payload).toMatchObject({
      event: 'transaction.created',
      data: {
        user_id: USER_A,
        wallet_id: walletId,
        type: 'EXPENSE',
        amount: 42.3,
        category_id: category.id,
        category_name: 'Comida',
        date: '2026-04-18',
        transfer_id: null,
      },
    });
  });

  it('201 creates INCOME with predefined category', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    const category = await prisma.category.findFirstOrThrow({
      where: { user_id: null, name: 'Nómina', type: 'INCOME' },
    });

    const res = await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ type: 'INCOME', amount: 1500, category_id: category.id });

    expect(res.status).toBe(201);
    expect((res.body as TransactionItem).type).toBe('INCOME');
  });

  it('201 with client-provided UUID (offline-first)', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    const clientId = '11111111-2222-3333-4444-555555555555';

    const res = await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ id: clientId, type: 'EXPENSE', amount: 5 });

    expect(res.status).toBe(201);
    expect((res.body as TransactionItem).id).toBe(clientId);
  });

  it('409 when sent id already exists', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    const clientId = '22222222-2222-3333-4444-555555555555';
    const token = signToken(USER_A);

    await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ id: clientId, type: 'EXPENSE', amount: 5 });

    const res = await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ id: clientId, type: 'EXPENSE', amount: 10 });

    expect(res.status).toBe(409);
  });

  it('defaults date to today when omitted', async () => {
    const { id: walletId } = await makeWallet(USER_A);

    const res = await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ type: 'EXPENSE', amount: 5 });

    expect(res.status).toBe(201);
    const today = new Date().toISOString().slice(0, 10);
    expect((res.body as TransactionItem).date).toBe(today);
  });

  it('400 with amount <= 0', async () => {
    const { id: walletId } = await makeWallet(USER_A);

    const res = await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ type: 'EXPENSE', amount: -1 });

    expect(res.status).toBe(400);
  });

  it('400 when category type does not match transaction type', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    const incomeCat = await prisma.category.findFirstOrThrow({
      where: { user_id: null, name: 'Nómina', type: 'INCOME' },
    });

    const res = await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ type: 'EXPENSE', amount: 10, category_id: incomeCat.id });

    expect(res.status).toBe(400);
  });

  it('400 with category of another user', async () => {
    const { id: walletId } = await makeWallet(USER_A);
    const otherCat = await prisma.category.create({
      data: { user_id: USER_B, name: 'SecretoB', icon: '🔒', type: 'EXPENSE' },
    });

    const res = await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ type: 'EXPENSE', amount: 10, category_id: otherCat.id });

    expect(res.status).toBe(400);
  });

  it('404 with non-existing wallet', async () => {
    const res = await request(createApp())
      .post(`/wallets/${VALID_UUID}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ type: 'EXPENSE', amount: 10 });

    expect(res.status).toBe(404);
  });

  it('404 with wallet of another user', async () => {
    const { id: walletId } = await makeWallet(USER_B);

    const res = await request(createApp())
      .post(`/wallets/${walletId}/transactions`)
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ type: 'EXPENSE', amount: 10 });

    expect(res.status).toBe(404);
  });
});
