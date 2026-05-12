import { Router } from 'express';
import { internalAuth } from '../middleware/internalAuth';
import { getInternalUser, listInternalUsers } from '../controllers/internal.controller';

export const internalRouter = Router();

internalRouter.get('/internal/users/:id', internalAuth, getInternalUser);
internalRouter.get('/internal/users', internalAuth, listInternalUsers);
