import { Router } from 'express';
import { healthRouter } from './health.routes';
import { deviceRouter } from './device.routes';

export const router = Router();

router.use(healthRouter);
router.use(deviceRouter);
