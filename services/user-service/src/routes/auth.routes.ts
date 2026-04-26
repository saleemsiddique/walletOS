import { Router } from 'express';
import { createRateLimiter } from '../middleware/rateLimiter';
import { register, login, refresh, logout } from '../controllers/auth.controller';

const authRateLimiter = createRateLimiter(10, 60);

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, register);
authRouter.post('/login', authRateLimiter, login);
authRouter.post('/refresh', authRateLimiter, refresh);
authRouter.post('/logout', authRateLimiter, logout);
