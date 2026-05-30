import type { Request, Response, RequestHandler } from 'express';
import * as statsService from '../services/stats.service';
import { statsDailyQuerySchema, statsQuerySchema } from '../validators/stats.validators';

async function handleStats(req: Request, res: Response): Promise<void> {
  const query = statsQuerySchema.parse(req.query);
  const result = await statsService.getStats(req.userId, query);
  res.json(result);
}

export const getStats: RequestHandler = (req, res, next) => {
  handleStats(req, res).catch(next);
};

async function handleDaily(req: Request, res: Response): Promise<void> {
  const query = statsDailyQuerySchema.parse(req.query);
  const result = await statsService.getStatsDaily(req.userId, query);
  res.json(result);
}

export const getStatsDaily: RequestHandler = (req, res, next) => {
  handleDaily(req, res).catch(next);
};

async function handleDashboard(req: Request, res: Response): Promise<void> {
  const result = await statsService.getDashboard(req.userId);
  res.json(result);
}

export const getDashboard: RequestHandler = (req, res, next) => {
  handleDashboard(req, res).catch(next);
};
