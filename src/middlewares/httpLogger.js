import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import logger from '../utils/logger.js';

const MAX_REQUEST_ID_LENGTH = 128;

const resolveRequestId = (req, res) => {
  const incomingHeader = req.headers['x-request-id'];
  const requestId =
    typeof incomingHeader === 'string' && incomingHeader.trim()
      ? incomingHeader.trim().slice(0, MAX_REQUEST_ID_LENGTH)
      : randomUUID();

  res.setHeader('X-Request-Id', requestId);
  return requestId;
};

/**
 * Middleware structured HTTP request logging berbasis `pino-http`.
 * Mencatat metode, URL, status code, sumber data cache/DB, serta latensi tanpa mengekspos token.
 */
const httpLogger = pinoHttp({
  logger,
  genReqId: resolveRequestId,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) {
      return 'error';
    }
    if (res.statusCode >= 400) {
      return 'warn';
    }
    return 'info';
  },
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.originalUrl || req.url} -> ${res.statusCode}`,
  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.originalUrl || req.url} -> ${res.statusCode} (${err.message})`,
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
      userAgent: req.headers['user-agent'],
    }),
    res: (res) => {
      const dataSource =
        typeof res.getHeader === 'function'
          ? res.getHeader('x-data-source')
          : res.headers?.['x-data-source'];

      return dataSource
        ? { statusCode: res.statusCode, dataSource }
        : { statusCode: res.statusCode };
    },
  },
});

export default httpLogger;
