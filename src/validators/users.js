import Joi from 'joi';

export const userPayloadSchema = Joi.object({
  name: Joi.string().trim().max(100).required(),
  email: Joi.string().trim().email().max(255).required(),
  password: Joi.string().min(6).max(72).required(),
  role: Joi.string().valid('user', 'admin').default('user'),
});

export const userUpdatePayloadSchema = Joi.object({
  name: Joi.string().trim().max(100).required(),
  email: Joi.string().trim().email().max(255).required(),
});
