import { DATA_SOURCE_HEADER } from '../config/env.js';
import AuthorizationError from '../exceptions/AuthorizationError.js';
import * as applicationsService from '../services/applicationsService.js';
import { sendSuccess } from '../utils/response.js';

export const postApplication = async (req, res) => {
  const userId = req.user.id;
  if (req.body.user_id && req.body.user_id !== userId) {
    throw new AuthorizationError('Anda hanya dapat melamar atas nama Anda sendiri');
  }

  const application = await applicationsService.addApplication(userId, req.body);
  return sendSuccess(res, { statusCode: 201, data: application });
};

export const getApplications = async (req, res) => {
  const applications = await applicationsService.getApplications(req.user.id);
  return sendSuccess(res, { data: { applications } });
};

export const getApplication = async (req, res) => {
  const { data: application, source } = await applicationsService.getApplicationById(
    req.params.id,
    req.user.id,
  );
  return sendSuccess(res, {
    data: application,
    headers: { [DATA_SOURCE_HEADER]: source },
  });
};

export const getApplicationsByUser = async (req, res) => {
  const { data: applications, source } =
    await applicationsService.getApplicationsByUserId(req.user.id, req.params.userId);
  return sendSuccess(res, {
    data: { applications },
    headers: { [DATA_SOURCE_HEADER]: source },
  });
};

export const getApplicationsByJob = async (req, res) => {
  const { data: applications, source } = await applicationsService.getApplicationsByJobId(
    req.user.id,
    req.params.jobId,
  );
  return sendSuccess(res, {
    data: { applications },
    headers: { [DATA_SOURCE_HEADER]: source },
  });
};

export const putApplication = async (req, res) => {
  await applicationsService.updateApplicationStatus(
    req.params.id,
    req.user.id,
    req.body.status,
  );
  return sendSuccess(res, { message: 'Status application berhasil diperbarui' });
};

export const deleteApplication = async (req, res) => {
  await applicationsService.deleteApplication(req.params.id, req.user.id);
  return sendSuccess(res, { message: 'Application berhasil dihapus' });
};
