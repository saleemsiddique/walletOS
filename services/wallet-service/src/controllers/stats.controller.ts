import type { Request, Response, RequestHandler } from 'express';
import * as statsService from '../services/stats.service';
import { statsQuerySchema } from '../validators/stats.validators';

async function handleStats(req: Request, res: Response): Promise<void> {
  const query = statsQuerySchema.parse(req.query);
  const result = await statsService.getStats(req.userId, query);
  res.json(result);
}

export const getStats: RequestHandler = (req, res, next) => {
  handleStats(req, res).catch(next);
};
