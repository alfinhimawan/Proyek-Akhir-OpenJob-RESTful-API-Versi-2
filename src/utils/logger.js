import { createRequire } from 'node:module';
import pino from 'pino';

const require = createRequire(import.meta.url);

const buildTransport = () => {
  if (process.env.NODE_ENV === 'production') {
    return undefined;
  }

  try {
    require.resolve('pino-pretty');
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  } catch {
    return undefined;
  }
};

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: buildTransport(),
});

export default logger;
