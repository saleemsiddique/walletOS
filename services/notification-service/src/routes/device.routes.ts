import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { createRateLimiter } from '../middleware/rateLimiter';
import { createDevice, deleteDevice } from '../controllers/device.controller';

const deviceLimiter = createRateLimiter(60, 60, (req) => req.userId ?? 'anon');

export const deviceRouter = Router();

deviceRouter.post('/devices', authenticate, deviceLimiter, createDevice);
deviceRouter.delete('/devices/:token', authenticate, deviceLimiter, deleteDevice);
