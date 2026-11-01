import Joi from 'joi';

export const jobPayloadSchema = Joi.object({
  company_id: Joi.string().max(50).required(),
  category_id: Joi.string().max(50).required(),
  title: Joi.string().trim().max(200).required(),
  description: Joi.string().required(),
  job_type: Joi.string()
    .valid('full-time', 'part-time', 'contract', 'internship', 'freelance')
    .required(),
  experience_level: Joi.string()
    .valid('entry', 'junior', 'mid', 'senior', 'lead')
    .required(),
  location_type: Joi.string().valid('onsite', 'remote', 'hybrid').required(),
  location_city: Joi.string().trim().max(150).allow('', null),
  salary_min: Joi.number().integer().min(0).allow(null),
  salary_max: Joi.number()
    .integer()
    .min(0)
    .allow(null)
    .when('salary_min', {
      is: Joi.number().required(),
      then: Joi.number().min(Joi.ref('salary_min')),
    }),
  is_salary_visible: Joi.boolean().default(true),
  status: Joi.string().valid('open', 'close').default('open'),
});

export const jobSearchQuerySchema = Joi.object({
  title: Joi.string().allow(''),
  'company-name': Joi.string().allow(''),
});
