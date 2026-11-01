import Joi from 'joi';

export const loginPayloadSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const refreshTokenPayloadSchema = Joi.object({
  refreshToken: Joi.string().required(),
});
