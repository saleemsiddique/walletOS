import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { createRateLimiter } from '../middleware/rateLimiter';
import { createBank } from '../controllers/bank.controller';

const bankLimiter = createRateLimiter(60, 60, (req) => req.userId ?? 'anon');

export const bankRouter = Router();

bankRouter.post('/banks', authenticate, bankLimiter, createBank);
