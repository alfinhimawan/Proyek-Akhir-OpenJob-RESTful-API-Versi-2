import 'dotenv/config';
import path from 'node:path';
import Joi from 'joi';

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_DOCUMENT_MIME_TYPE = 'application/pdf';
export const PDF_MAGIC_SIGNATURE = '%PDF-';

export const CACHE_TTL_SECONDS = 3600;
export const DATA_SOURCE_HEADER = 'X-Data-Source';
export const DATA_SOURCE_CACHE = 'cache';
export const DATA_SOURCE_DATABASE = 'database';

export const APPLICATION_QUEUE_NAME = 'job_applications';
export const APPLICATION_DLX_NAME = 'job_applications.dlx';
export const APPLICATION_DLQ_NAME = 'job_applications.dlq';
export const APPLICATION_DLQ_ROUTING_KEY = 'job_applications.dead';

export const CONSUMER_PREFETCH_COUNT = 5;
export const CONSUMER_MAX_RETRIES = 3;
export const CONSUMER_RETRY_DELAY_MS = 2000;

export const OUTBOX_POLL_INTERVAL_MS = 3000;
export const OUTBOX_BATCH_SIZE = 20;
export const OUTBOX_MAX_ATTEMPTS = 10;
export const OUTBOX_BASE_RETRY_DELAY_MS = 2000;

export const UPLOADS_DIRECTORY = path.resolve(process.cwd(), 'uploads');

const envSchema = Joi.object({
  HOST: Joi.string().trim().default('localhost'),
  PORT: Joi.number().port().default(3000),

  PGUSER: Joi.string().trim().required(),
  PGPASSWORD: Joi.string().required(),
  PGDATABASE: Joi.string().trim().required(),
  PGHOST: Joi.string().trim().default('localhost'),
  PGPORT: Joi.number().port().default(5432),

  ACCESS_TOKEN_KEY: Joi.string().min(16).required(),
  REFRESH_TOKEN_KEY: Joi.string().min(16).required(),
  ACCESS_TOKEN_AGE: Joi.string().trim().default('3h'),
  REFRESH_TOKEN_AGE: Joi.string().trim().default('7d'),

  REDIS_HOST: Joi.string().trim().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),

  RABBITMQ_HOST: Joi.string().trim().required(),
  RABBITMQ_PORT: Joi.number().port().default(5672),
  RABBITMQ_USER: Joi.string().trim().required(),
  RABBITMQ_PASSWORD: Joi.string().required(),
  AMQP_URL: Joi.string().trim().allow('').default(''),

  MAIL_HOST: Joi.string().trim().required(),
  MAIL_PORT: Joi.number().port().default(587),
  MAIL_USER: Joi.string().trim().required(),
  MAIL_PASSWORD: Joi.string().required(),
  MAIL_SENDER: Joi.string().trim().allow('').default(''),
}).unknown(true);

const { error, value: env } = envSchema.validate(process.env, {
  abortEarly: false,
});

if (error) {
  const details = error.details.map((item) => item.message).join('; ');
  throw new Error(`Konfigurasi environment tidak valid: ${details}`);
}

const buildAmqpUrl = () => {
  if (env.AMQP_URL) {
    return env.AMQP_URL;
  }
  const encodedUser = encodeURIComponent(env.RABBITMQ_USER);
  const encodedPass = encodeURIComponent(env.RABBITMQ_PASSWORD);
  return `amqp://${encodedUser}:${encodedPass}@${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}`;
};

const config = {
  server: {
    host: env.HOST,
    port: env.PORT,
  },
  postgres: {
    user: env.PGUSER,
    password: env.PGPASSWORD,
    database: env.PGDATABASE,
    host: env.PGHOST,
    port: env.PGPORT,
  },
  token: {
    accessKey: env.ACCESS_TOKEN_KEY,
    refreshKey: env.REFRESH_TOKEN_KEY,
    accessAge: env.ACCESS_TOKEN_AGE,
    refreshAge: env.REFRESH_TOKEN_AGE,
  },
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
  },
  rabbitmq: {
    host: env.RABBITMQ_HOST,
    port: env.RABBITMQ_PORT,
    user: env.RABBITMQ_USER,
    password: env.RABBITMQ_PASSWORD,
    url: buildAmqpUrl(),
  },
  mail: {
    host: env.MAIL_HOST,
    port: env.MAIL_PORT,
    user: env.MAIL_USER,
    password: env.MAIL_PASSWORD,
    sender: env.MAIL_SENDER || `OpenJob <${env.MAIL_USER}>`,
  },
};

export default config;
