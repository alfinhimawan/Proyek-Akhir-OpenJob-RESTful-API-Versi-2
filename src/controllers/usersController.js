import { DATA_SOURCE_HEADER } from '../config/env.js';
import * as usersService from '../services/usersService.js';
import { sendSuccess } from '../utils/response.js';

export const postUser = async (req, res) => {
  const id = await usersService.addUser(req.body);
  return sendSuccess(res, { statusCode: 201, data: { id } });
};

export const getUser = async (req, res) => {
  const { data: user, source } = await usersService.getUserById(req.params.id);
  return sendSuccess(res, {
    data: user,
    headers: { [DATA_SOURCE_HEADER]: source },
  });
};

export const putUser = async (req, res) => {
  await usersService.updateUser(req.params.id, req.user.id, req.body);
  return sendSuccess(res, { message: 'User berhasil diperbarui' });
};
