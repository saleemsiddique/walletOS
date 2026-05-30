import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { createRateLimiter } from '../middleware/rateLimiter';
import { createTransfer } from '../controllers/transfer.controller';

const transferLimiter = createRateLimiter(60, 60, (req) => req.userId ?? 'anon');

export const transferRouter = Router();

transferRouter.post('/transfers', authenticate, transferLimiter, createTransfer);
