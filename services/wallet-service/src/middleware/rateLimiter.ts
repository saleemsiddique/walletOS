import type { RequestHandler, Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { getRedis } from '../lib/redis';
import { RateLimitError } from './errorHandler';

// Atomic sliding window via Lua: removes stale entries, checks count,
// adds current request only if under the limit.
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window_ms)
local count = redis.call('ZCARD', key)

if count < max then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window_ms + 1000)
  return 0
else
  return 1
end
`;

async function applyRateLimit(
  req: Request,
  next: NextFunction,
  max: number,
  windowMs: number,
  keyFn: (req: Request) => string,
): Promise<void> {
  const keyValue = keyFn(req);
  const routePath = (req.route as { path?: string } | undefined)?.path ?? req.path;
  const endpoint = `${req.method}:${routePath}`;
  const redisKey = `rl:${keyValue}:${endpoint}`;
  const now = Date.now();
  const member = `${now}:${randomBytes(4).toString('hex')}`;

  try {
    const result = await getRedis().eval(
      SLIDING_WINDOW_SCRIPT,
      1,
      redisKey,
      now.toString(),
      windowMs.toString(),
      max.toString(),
      member,
    );

    if (result === 1) {
      next(new RateLimitError());
    } else {
      next();
    }
  } catch {
    // Redis failure: let the request through to avoid blocking all traffic
    next();
  }
}

export function createRateLimiter(
  max: number,
  windowSeconds: number,
  keyFn: (req: Request) => string = (req) => req.ip ?? 'unknown',
): RequestHandler {
  const windowMs = windowSeconds * 1000;

  return (req: Request, _res: Response, next: NextFunction): void => {
    applyRateLimit(req, next, max, windowMs, keyFn).catch(next);
  };
}
