import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { createRateLimiter } from '../middleware/rateLimiter';
import { listCategories } from '../controllers/category.controller';

const categoryLimiter = createRateLimiter(60, 60, (req) => req.userId ?? 'anon');

export const categoryRouter = Router();

categoryRouter.get('/categories', authenticate, categoryLimiter, listCategories);
