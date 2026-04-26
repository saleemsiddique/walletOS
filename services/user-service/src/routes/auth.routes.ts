import { Router } from 'express';
import { createRateLimiter } from '../middleware/rateLimiter';
import { register } from '../controllers/auth.controller';

const authRateLimiter = createRateLimiter(10, 60);

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, register);
