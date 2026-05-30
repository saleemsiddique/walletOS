import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { createRateLimiter } from '../middleware/rateLimiter';
import { listRecurring } from '../controllers/recurring.controller';

const recurringLimiter = createRateLimiter(60, 60, (req) => req.userId ?? 'anon');

export const recurringRouter = Router();

recurringRouter.get('/recurring', authenticate, recurringLimiter, listRecurring);
