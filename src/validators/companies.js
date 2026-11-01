import Joi from 'joi';

export const companyPayloadSchema = Joi.object({
  name: Joi.string().trim().max(150).required(),
  location: Joi.string().trim().max(150).required(),
  description: Joi.string().allow('').optional(),
});
