import { Router } from 'express';
import { healthRouter } from './health.routes';
import { deviceRouter } from './device.routes';
import { notificationRouter } from './notification.routes';

export const router = Router();

router.use(healthRouter);
router.use(deviceRouter);
router.use(notificationRouter);
