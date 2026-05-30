import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { createRateLimiter } from '../middleware/rateLimiter';
import { getStats, getStatsDaily, getDashboard } from '../controllers/stats.controller';

const statsLimiter = createRateLimiter(60, 60, (req) => req.userId ?? 'anon');

export const statsRouter = Router();

statsRouter.get('/stats', authenticate, statsLimiter, getStats);
statsRouter.get('/stats/daily', authenticate, statsLimiter, getStatsDaily);
statsRouter.get('/dashboard', authenticate, statsLimiter, getDashboard);
