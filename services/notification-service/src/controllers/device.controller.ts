import type { Request, Response, RequestHandler } from 'express';
import { createDeviceSchema } from '../validators/device.validators';
import * as deviceService from '../services/device.service';

async function handleCreate(req: Request, res: Response): Promise<void> {
  const input = createDeviceSchema.parse(req.body);
  const result = await deviceService.upsertDevice(req.userId, input);
  res.status(201).json(result);
}

export const createDevice: RequestHandler = (req, res, next) => {
  handleCreate(req, res).catch(next);
};

async function handleDelete(req: Request, res: Response): Promise<void> {
  const token = req.params['token'] ?? '';
  await deviceService.removeDevice(token);
  res.status(204).send();
}

export const deleteDevice: RequestHandler = (req, res, next) => {
  handleDelete(req, res).catch(next);
};
