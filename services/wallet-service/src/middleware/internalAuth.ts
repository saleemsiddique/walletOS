import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { UnauthorizedError } from './errorHandler';

export const internalAuth: RequestHandler = (req, _res, next) => {
  const secret = req.headers['x-internal-secret'];

  if (!secret || secret !== env.INTERNAL_SECRET) {
    return next(new UnauthorizedError('Invalid or missing internal secret'));
  }

  next();
};
