import { Router } from 'express';
import { createRateLimiter } from '../middleware/rateLimiter';
import { register, login, refresh, logout, apple, google } from '../controllers/auth.controller';

const authRateLimiter = createRateLimiter(10, 60);

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, register);
authRouter.post('/login', authRateLimiter, login);
authRouter.post('/refresh', authRateLimiter, refresh);
authRouter.post('/logout', authRateLimiter, logout);
authRouter.post('/apple', authRateLimiter, apple);
authRouter.post('/google', authRateLimiter, google);
