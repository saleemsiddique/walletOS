import type { Request, Response, RequestHandler } from 'express';
import * as userService from '../services/user.service';
import { patchMeSchema } from '../validators/me.validators';

async function handleGetMe(req: Request, res: Response): Promise<void> {
  const result = await userService.getMe(req.userId);
  res.json(result);
}

export const getMe: RequestHandler = (req, res, next) => {
  handleGetMe(req, res).catch(next);
};

async function handlePatchMe(req: Request, res: Response): Promise<void> {
  const input = patchMeSchema.parse(req.body);
  const result = await userService.patchMe(req.userId, input);
  res.json(result);
}

export const patchMe: RequestHandler = (req, res, next) => {
  handlePatchMe(req, res).catch(next);
};

async function handleDeleteMe(req: Request, res: Response): Promise<void> {
  await userService.deleteMe(req.userId);
  res.status(204).send();
}

export const deleteMe: RequestHandler = (req, res, next) => {
  handleDeleteMe(req, res).catch(next);
};
