import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import * as portfolioService from '../services/portfolio.service';

const walletIdParamSchema = z.object({ id: z.string().uuid() });

async function handleGet(req: Request, res: Response): Promise<void> {
  const { id: walletId } = walletIdParamSchema.parse(req.params);
  const result = await portfolioService.getPortfolio(req.userId, walletId);
  res.json(result);
}

export const getPortfolio: RequestHandler = (req, res, next) => {
  handleGet(req, res).catch(next);
};
