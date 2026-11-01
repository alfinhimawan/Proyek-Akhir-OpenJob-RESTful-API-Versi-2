import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import InvariantError from '../exceptions/InvariantError.js';
import AuthenticationError from '../exceptions/AuthenticationError.js';

const { accessKey, refreshKey, accessAge, refreshAge } = config.token;

export const generateAccessToken = (payload) =>
  jwt.sign(payload, accessKey, { expiresIn: accessAge });

export const generateRefreshToken = (payload) =>
  jwt.sign(payload, refreshKey, { expiresIn: refreshAge });

export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, accessKey);
  } catch {
    throw new AuthenticationError('Access token tidak valid atau sudah kedaluwarsa');
  }
};

export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, refreshKey);
  } catch {
    throw new InvariantError('Refresh token tidak valid');
  }
};
