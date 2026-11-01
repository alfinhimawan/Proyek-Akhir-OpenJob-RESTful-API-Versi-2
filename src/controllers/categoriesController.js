import * as categoriesService from '../services/categoriesService.js';
import { sendSuccess } from '../utils/response.js';

export const postCategory = async (req, res) => {
  const id = await categoriesService.addCategory(req.body);
  return sendSuccess(res, { statusCode: 201, data: { id } });
};

export const getCategories = async (_req, res) => {
  const categories = await categoriesService.getCategories();
  return sendSuccess(res, { data: { categories } });
};

export const getCategory = async (req, res) => {
  const category = await categoriesService.getCategoryById(req.params.id);
  return sendSuccess(res, { data: category });
};

export const putCategory = async (req, res) => {
  await categoriesService.updateCategory(req.params.id, req.body);
  return sendSuccess(res, { message: 'Category berhasil diperbarui' });
};

export const deleteCategory = async (req, res) => {
  await categoriesService.deleteCategory(req.params.id);
  return sendSuccess(res, { message: 'Category berhasil dihapus' });
};
