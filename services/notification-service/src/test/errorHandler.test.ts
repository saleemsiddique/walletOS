import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import {
  errorHandler,
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  RateLimitError,
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
      throw new ValidationError('Invalid input', { token: ['Required'] });
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual({ token: ['Required'] });
  });

  it('returns 401 for UnauthorizedError', async () => {
    const app = buildTestApp(() => {
      throw new UnauthorizedError('Token expired');
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 for NotFoundError', async () => {
    const app = buildTestApp(() => {
      throw new NotFoundError('Notification not found');
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 409 for ConflictError', async () => {
    const app = buildTestApp(() => {
      throw new ConflictError('Token already assigned');
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 429 for RateLimitError', async () => {
    const app = buildTestApp(() => {
      throw new RateLimitError();
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('returns 400 for ZodError with fieldErrors', async () => {
    const app = buildTestApp(() => {
      const schema = z.object({ token: z.string().min(1) });
      schema.parse({ token: '' });
      throw new Error('unreachable');
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 500 for unknown errors', async () => {
    const app = buildTestApp(() => {
      throw new Error('Unexpected failure');
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
