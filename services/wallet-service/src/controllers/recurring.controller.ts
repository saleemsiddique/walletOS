import type { Request, Response, RequestHandler } from 'express';
import * as recurringService from '../services/recurring.service';

async function handleList(req: Request, res: Response): Promise<void> {
  const result = await recurringService.listRecurring(req.userId);
  res.json(result);
}

export const listRecurring: RequestHandler = (req, res, next) => {
  handleList(req, res).catch(next);
};
