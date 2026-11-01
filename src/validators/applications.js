import Joi from 'joi';

export const applicationPayloadSchema = Joi.object({
  user_id: Joi.string().max(50),
  job_id: Joi.string().max(50).required(),
  // Pelamar hanya boleh membuat lamaran berstatus pending.
  status: Joi.string().valid('pending').default('pending'),
});

export const applicationStatusPayloadSchema = Joi.object({
  status: Joi.string().valid('pending', 'accepted', 'rejected').required(),
});
