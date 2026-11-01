import AuthenticationError from '../exceptions/AuthenticationError.js';
import { verifyAccessToken } from '../utils/tokenManager.js';

const auth = (req, _res, next) => {
  const header = req.headers.authorization;
  const [scheme, token] = header ? header.split(' ') : [];

  if (scheme !== 'Bearer' || !token) {
    return next(new AuthenticationError('Autentikasi diperlukan'));
  }

  try {
    const { id } = verifyAccessToken(token);
    req.user = { id };
    return next();
  } catch (error) {
    return next(error);
  }
};

export default auth;
