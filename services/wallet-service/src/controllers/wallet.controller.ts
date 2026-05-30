import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import * as walletService from '../services/wallet.service';
import { createWalletSchema, updateWalletSchema } from '../validators/wallet.validators';

const bankIdParamSchema = z.object({ id: z.string().uuid() });
const walletIdParamSchema = z.object({ id: z.string().uuid() });

async function handleCreate(req: Request, res: Response): Promise<void> {
  const { id: bankId } = bankIdParamSchema.parse(req.params);
  const input = createWalletSchema.parse(req.body);
  const result = await walletService.createWallet(req.userId, bankId, input);
  res.status(201).json(result);
}

export const createWallet: RequestHandler = (req, res, next) => {
  handleCreate(req, res).catch(next);
};

async function handleListByBank(req: Request, res: Response): Promise<void> {
  const { id: bankId } = bankIdParamSchema.parse(req.params);
  const result = await walletService.listWalletsByBank(req.userId, bankId);
  res.json(result);
}

export const listWalletsByBank: RequestHandler = (req, res, next) => {
  handleListByBank(req, res).catch(next);
};

async function handleListAll(req: Request, res: Response): Promise<void> {
  const result = await walletService.listAllWallets(req.userId);
  res.json(result);
}

export const listAllWallets: RequestHandler = (req, res, next) => {
  handleListAll(req, res).catch(next);
};

async function handleUpdate(req: Request, res: Response): Promise<void> {
  const { id } = walletIdParamSchema.parse(req.params);
  const input = updateWalletSchema.parse(req.body);
  const result = await walletService.updateWallet(req.userId, id, input);
  res.json(result);
}

export const updateWallet: RequestHandler = (req, res, next) => {
  handleUpdate(req, res).catch(next);
};
