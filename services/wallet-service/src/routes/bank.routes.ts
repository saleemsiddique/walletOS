import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { createRateLimiter } from '../middleware/rateLimiter';
import { createBank, listBanks, updateBank } from '../controllers/bank.controller';

const bankLimiter = createRateLimiter(60, 60, (req) => req.userId ?? 'anon');

export const bankRouter = Router();

bankRouter.get('/banks', authenticate, bankLimiter, listBanks);
bankRouter.post('/banks', authenticate, bankLimiter, createBank);
bankRouter.patch('/banks/:id', authenticate, bankLimiter, updateBank);
