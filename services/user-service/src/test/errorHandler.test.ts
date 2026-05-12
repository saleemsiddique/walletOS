import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import {
  errorHandler,
  ValidationError,
  UnauthorizedError,
  ConflictError,
} from '../middleware/errorHandler';

function buildTestApp(throwFn: () => never) {
  const app = express();
  app.get('/test', () => {
    throwFn();
  });
  app.use(errorHandler);
  return app;
}

describe('errorHandler middleware', () => {
  it('returns 400 for ValidationError with details', async () => {
    const app = buildTestApp(() => {
      throw new ValidationError('Invalid input', { email: ['Invalid email'] });
    });

    const res = await request(app).get('/test');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual({ email: ['Invalid email'] });
  });

  it('returns 401 for UnauthorizedError', async () => {
    const app = buildTestApp(() => {
      throw new UnauthorizedError('Token expired');
    });

    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('Token expired');
  });

  it('returns 409 for ConflictError', async () => {
    const app = buildTestApp(() => {
      throw new ConflictError('Email already exists');
    });

    const res = await request(app).get('/test');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 400 for ZodError with fieldErrors', async () => {
    const app = buildTestApp(() => {
      const schema = z.object({ email: z.string().email() });
      schema.parse({ email: 'not-an-email' });
      throw new Error('unreachable');
    });

    const res = await request(app).get('/test');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeDefined();
  });

  it('returns 500 for unknown errors without exposing internal message in production', async () => {
    const original = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    const app = buildTestApp(() => {
      throw new Error('database connection string leaked');
    });

    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.error.message).toBe('Internal server error');

    process.env['NODE_ENV'] = original;
  });
});
