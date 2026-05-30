import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { prisma } from '../lib/prisma';
import { seedCategories } from '../lib/seed';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'test-jwt-secret-minimum-32-characters-long!!';

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m' });
}

type CategoryItem = {
  id: string;
  name: string;
  icon: string;
  type: 'INCOME' | 'EXPENSE';
  is_custom: boolean;
};

type ListBody = { categories: CategoryItem[] };

const USER_A = 'a0000000-0000-0000-0000-000000000001';
const USER_B = 'b0000000-0000-0000-0000-000000000002';

describe('GET /categories', () => {
  beforeEach(async () => {
    await seedCategories();
  });

  it('401 without token', async () => {
    const res = await request(createApp()).get('/categories');
    expect(res.status).toBe(401);
  });

  it('200 returns predefined + custom of authenticated user', async () => {
    await prisma.category.create({
      data: { user_id: USER_A, name: 'Gimnasio', icon: '💪', type: 'EXPENSE' },
    });

    const res = await request(createApp())
      .get('/categories')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    expect(res.status).toBe(200);
    expect(body.categories).toHaveLength(15);
    expect(body.categories.find((c) => c.name === 'Gimnasio')).toMatchObject({
      name: 'Gimnasio',
      is_custom: true,
    });
  });

  it('orders predefined first, custom last', async () => {
    await prisma.category.create({
      data: { user_id: USER_A, name: 'Gimnasio', icon: '💪', type: 'EXPENSE' },
    });

    const res = await request(createApp())
      .get('/categories')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    const flags = body.categories.map((c) => c.is_custom);
    const lastPredefIndex = flags.lastIndexOf(false);
    const firstCustomIndex = flags.indexOf(true);
    expect(lastPredefIndex).toBeLessThan(firstCustomIndex);
  });

  it('filters by ?type=EXPENSE', async () => {
    const res = await request(createApp())
      .get('/categories?type=EXPENSE')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    expect(res.status).toBe(200);
    expect(body.categories).toHaveLength(9);
    expect(body.categories.every((c) => c.type === 'EXPENSE')).toBe(true);
  });

  it('does not include custom categories of other users', async () => {
    await prisma.category.create({
      data: { user_id: USER_B, name: 'SecretoB', icon: '🔒', type: 'EXPENSE' },
    });

    const res = await request(createApp())
      .get('/categories')
      .set('Authorization', `Bearer ${signToken(USER_A)}`);
    const body = res.body as ListBody;

    expect(body.categories.find((c) => c.name === 'SecretoB')).toBeUndefined();
  });
});
