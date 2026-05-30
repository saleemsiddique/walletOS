import { Router } from 'express';
import { healthRouter } from './health.routes';
import { categoryRouter } from './category.routes';

export const router = Router();

router.use(healthRouter);
router.use(categoryRouter);
