import InvariantError from '../exceptions/InvariantError.js';

/**
 * Middleware validasi Joi yang dapat dipakai ulang.
 * @param schema skema Joi
 * @param source 'body' | 'query' | 'params'
 */
const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    const { error, value } = schema.validate(req[source] ?? {}, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return next(new InvariantError(error.details.map((d) => d.message).join(', ')));
    }

    // req.query bersifat getter-only di Express 5, jadi didefinisikan ulang.
    Object.defineProperty(req, source, {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    return next();
  };

export default validate;
