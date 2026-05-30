import { vi } from 'vitest';

vi.mock('../lib/rabbitmq', () => ({
  connectRabbitMQ: vi.fn(),
  publishEvent: vi.fn(),
}));

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { publishEvent } from '../lib/rabbitmq';
import { calculateWalletBalance, calculateUserTotalBalance } from '../lib/balance';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-minimum-32-characters-long!!';

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
}

type TransferLeg = {
  id: string;
  wallet_id: string;
  wallet_name: string;
  bank_name: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  category: null;
  note: string | null;
  date: string;
  transfer_id: string;
  paired_wallet_name: string;
};

type TransferBody = {
  transfer_id: string;
  expense: TransferLeg;
  income: TransferLeg;
};

const USER_A = 'a0000000-0000-0000-0000-000000000001';
const USER_B = 'b0000000-0000-0000-0000-000000000002';
const VALID_UUID = '00000000-0000-0000-0000-000000000abc';

async function setupTwoWallets(userId: string, fromInitial = '1000.00', toInitial = '0.00') {
  const bank = await prisma.bank.create({ data: { user_id: userId, name: 'Santander' } });
  const from = await prisma.wallet.create({
    data: { user_id: userId, bank_id: bank.id, name: 'Nómina', initial_balance: fromInitial },
  });
  const to = await prisma.wallet.create({
    data: { user_id: userId, bank_id: bank.id, name: 'Ahorro', initial_balance: toInitial },
  });
  return { from, to };
}

describe('POST /transfers', () => {
  beforeEach(() => {
    vi.mocked(publishEvent).mockClear();
  });

  it('401 without token', async () => {
    const res = await request(createApp())
      .post('/transfers')
      .send({ from_wallet_id: VALID_UUID, to_wallet_id: VALID_UUID, amount: 10 });
    expect(res.status).toBe(401);
  });

  it('201 creates EXPENSE+INCOME pair with shared transfer_id and null category', async () => {
    const { from, to } = await setupTwoWallets(USER_A);

    const res = await request(createApp())
      .post('/transfers')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({
        from_wallet_id: from.id,
        to_wallet_id: to.id,
        amount: 500,
        note: 'Ahorro mensual',
        date: '2026-04-18',
      });

    expect(res.status).toBe(201);
    const body = res.body as TransferBody;
    expect(body.transfer_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.expense).toMatchObject({
      wallet_id: from.id,
      wallet_name: 'Nómina',
      type: 'EXPENSE',
      amount: 500,
      category: null,
      transfer_id: body.transfer_id,
      paired_wallet_name: 'Ahorro',
      note: 'Ahorro mensual',
      date: '2026-04-18',
    });
    expect(body.income).toMatchObject({
      wallet_id: to.id,
      wallet_name: 'Ahorro',
      type: 'INCOME',
      amount: 500,
      category: null,
      transfer_id: body.transfer_id,
      paired_wallet_name: 'Nómina',
    });

    const persisted = await prisma.transaction.findMany({
      where: { transfer_id: body.transfer_id },
    });
    expect(persisted).toHaveLength(2);
    expect(persisted.every((t) => t.category_id === null)).toBe(true);
  });

  it('decreases from_wallet balance and increases to_wallet balance by amount', async () => {
    const { from, to } = await setupTwoWallets(USER_A, '1000.00', '200.00');

    await request(createApp())
      .post('/transfers')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ from_wallet_id: from.id, to_wallet_id: to.id, amount: 300 });

    const fromBalance = await calculateWalletBalance(from.id);
    const toBalance = await calculateWalletBalance(to.id);
    expect(fromBalance.toNumber()).toBe(700);
    expect(toBalance.toNumber()).toBe(500);
  });

  it('keeps user total balance invariant', async () => {
    const { from, to } = await setupTwoWallets(USER_A, '500.00', '500.00');
    const before = await calculateUserTotalBalance(USER_A);

    await request(createApp())
      .post('/transfers')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ from_wallet_id: from.id, to_wallet_id: to.id, amount: 123.45 });

    const after = await calculateUserTotalBalance(USER_A);
    expect(after.toNumber()).toBe(before.toNumber());
  });

  it('defaults date to today when omitted', async () => {
    const { from, to } = await setupTwoWallets(USER_A);

    const res = await request(createApp())
      .post('/transfers')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ from_wallet_id: from.id, to_wallet_id: to.id, amount: 10 });

    const today = new Date().toISOString().slice(0, 10);
    expect((res.body as TransferBody).expense.date).toBe(today);
    expect((res.body as TransferBody).income.date).toBe(today);
  });

  it('400 when from_wallet_id === to_wallet_id', async () => {
    const { from } = await setupTwoWallets(USER_A);

    const res = await request(createApp())
      .post('/transfers')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ from_wallet_id: from.id, to_wallet_id: from.id, amount: 10 });

    expect(res.status).toBe(400);
  });

  it('400 with amount <= 0', async () => {
    const { from, to } = await setupTwoWallets(USER_A);

    const res = await request(createApp())
      .post('/transfers')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ from_wallet_id: from.id, to_wallet_id: to.id, amount: -5 });

    expect(res.status).toBe(400);
  });

  it('404 when from_wallet_id does not exist', async () => {
    const { to } = await setupTwoWallets(USER_A);

    const res = await request(createApp())
      .post('/transfers')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ from_wallet_id: VALID_UUID, to_wallet_id: to.id, amount: 10 });

    expect(res.status).toBe(404);
  });

  it('404 when from_wallet_id belongs to another user', async () => {
    const { from: foreign } = await setupTwoWallets(USER_B);
    const { to } = await setupTwoWallets(USER_A);

    const res = await request(createApp())
      .post('/transfers')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ from_wallet_id: foreign.id, to_wallet_id: to.id, amount: 10 });

    expect(res.status).toBe(404);
  });

  it('404 when to_wallet_id belongs to another user', async () => {
    const { from } = await setupTwoWallets(USER_A);
    const { to: foreign } = await setupTwoWallets(USER_B);

    const res = await request(createApp())
      .post('/transfers')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ from_wallet_id: from.id, to_wallet_id: foreign.id, amount: 10 });

    expect(res.status).toBe(404);
  });

  it('does NOT publish transaction.created event', async () => {
    const { from, to } = await setupTwoWallets(USER_A);

    await request(createApp())
      .post('/transfers')
      .set('Authorization', `Bearer ${signToken(USER_A)}`)
      .send({ from_wallet_id: from.id, to_wallet_id: to.id, amount: 10 });

    expect(publishEvent).not.toHaveBeenCalled();
  });
});
