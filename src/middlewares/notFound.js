import NotFoundError from '../exceptions/NotFoundError.js';

const notFound = (req, _res, next) =>
  next(new NotFoundError(`Route ${req.method} ${req.path} tidak ditemukan`));

export default notFound;
