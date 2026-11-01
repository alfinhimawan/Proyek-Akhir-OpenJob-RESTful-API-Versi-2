import * as usersService from '../services/usersService.js';
import * as authenticationsService from '../services/authenticationsService.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../utils/tokenManager.js';
import { sendSuccess } from '../utils/response.js';

export const postAuthentication = async (req, res) => {
  const { email, password } = req.body;
  const id = await usersService.verifyUserCredential(email, password);

  const accessToken = generateAccessToken({ id });
  const refreshToken = generateRefreshToken({ id });
  await authenticationsService.addRefreshToken(refreshToken, id);

  return sendSuccess(res, { statusCode: 200, data: { accessToken, refreshToken } });
};

export const putAuthentication = async (req, res) => {
  const { refreshToken } = req.body;
  const { id } = verifyRefreshToken(refreshToken);
  await authenticationsService.verifyRefreshTokenRegistered(refreshToken);

  const accessToken = generateAccessToken({ id });
  return sendSuccess(res, { data: { accessToken } });
};

export const deleteAuthentication = async (req, res) => {
  const { refreshToken } = req.body;
  await authenticationsService.verifyRefreshTokenRegistered(refreshToken);
  await authenticationsService.deleteRefreshToken(refreshToken);

  return sendSuccess(res, { message: 'Refresh token berhasil dihapus' });
};
