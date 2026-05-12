import type { Request, Response, RequestHandler } from 'express';
import * as passwordService from '../services/password.service';
import { forgotPasswordSchema, resetPasswordSchema } from '../validators/auth.validators';

async function handleForgotPassword(req: Request, res: Response): Promise<void> {
  const input = forgotPasswordSchema.parse(req.body);
  await passwordService.forgotPassword(input);
  res.status(204).send();
}

export const forgotPassword: RequestHandler = (req, res, next) => {
  handleForgotPassword(req, res).catch(next);
};

async function handleResetPassword(req: Request, res: Response): Promise<void> {
  const input = resetPasswordSchema.parse(req.body);
  await passwordService.resetPassword(input);
  res.status(204).send();
}

export const resetPassword: RequestHandler = (req, res, next) => {
  handleResetPassword(req, res).catch(next);
};
