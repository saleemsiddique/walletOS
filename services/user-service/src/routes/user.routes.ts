import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { createRateLimiter } from '../middleware/rateLimiter';
import { getMe, patchMe, deleteMe } from '../controllers/user.controller';

const meLimiter = createRateLimiter(60, 60);

export const userRouter = Router();

userRouter.get('/me', meLimiter, authenticate, getMe);
userRouter.patch('/me', meLimiter, authenticate, patchMe);
userRouter.delete('/me', meLimiter, authenticate, deleteMe);
