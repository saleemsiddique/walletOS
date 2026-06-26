import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from '../middleware/errorHandler';

export function verifyAccessToken(token: string): { userId: string } {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof decoded !== 'object' || decoded === null || !('userId' in decoded)) {
      throw new UnauthorizedError('Invalid token payload');
    }
    return { userId: decoded['userId'] as string };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Invalid or expired token');
  }
}
