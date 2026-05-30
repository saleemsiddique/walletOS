import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { createRateLimiter } from '../middleware/rateLimiter';
import { getPortfolio } from '../controllers/portfolio.controller';

const portfolioLimiter = createRateLimiter(60, 60, (req) => req.userId ?? 'anon');

export const portfolioRouter = Router();

portfolioRouter.get('/wallets/:id/portfolio', authenticate, portfolioLimiter, getPortfolio);
