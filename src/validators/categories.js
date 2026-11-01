import Joi from 'joi';

export const categoryPayloadSchema = Joi.object({
  name: Joi.string().trim().max(100).required(),
});
