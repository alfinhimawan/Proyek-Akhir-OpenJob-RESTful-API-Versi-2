import * as jobsService from '../services/jobsService.js';
import { sendSuccess } from '../utils/response.js';

export const postJob = async (req, res) => {
  const id = await jobsService.addJob(req.user.id, req.body);
  return sendSuccess(res, { statusCode: 201, data: { id } });
};

export const getJobs = async (req, res) => {
  const jobs = await jobsService.getJobs(req.query);
  return sendSuccess(res, { data: { jobs } });
};

export const getJobsByCompany = async (req, res) => {
  const jobs = await jobsService.getJobsByCompanyId(req.params.companyId);
  return sendSuccess(res, { data: { jobs } });
};

export const getJobsByCategory = async (req, res) => {
  const jobs = await jobsService.getJobsByCategoryId(req.params.categoryId);
  return sendSuccess(res, { data: { jobs } });
};

export const getJob = async (req, res) => {
  const job = await jobsService.getJobById(req.params.id);
  return sendSuccess(res, { data: job });
};

export const putJob = async (req, res) => {
  await jobsService.updateJob(req.params.id, req.user.id, req.body);
  return sendSuccess(res, { message: 'Job berhasil diperbarui' });
};

export const deleteJob = async (req, res) => {
  await jobsService.deleteJob(req.params.id, req.user.id);
  return sendSuccess(res, { message: 'Job berhasil dihapus' });
};
