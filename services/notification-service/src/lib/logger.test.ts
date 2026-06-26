import { logger } from './logger';

describe('logger', () => {
  it('is a pino instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
  });

  it('is silent in test environment', () => {
    expect(logger.level).toBe('silent');
  });
});
