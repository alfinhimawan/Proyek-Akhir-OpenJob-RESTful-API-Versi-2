import { DATA_SOURCE_HEADER } from '../config/env.js';
import * as applicationsService from '../services/applicationsService.js';
import * as bookmarksService from '../services/bookmarksService.js';
import * as usersService from '../services/usersService.js';
import { sendSuccess } from '../utils/response.js';

export const getProfile = async (req, res) => {
  const { data: user, source } = await usersService.getUserById(req.user.id);
  return sendSuccess(res, {
    data: user,
    headers: { [DATA_SOURCE_HEADER]: source },
  });
};

export const getProfileApplications = async (req, res) => {
  const applications = await applicationsService.getProfileApplications(req.user.id);
  return sendSuccess(res, { data: { applications } });
};

export const getProfileBookmarks = async (req, res) => {
  const { data: bookmarks, source } = await bookmarksService.getBookmarksByUserId(
    req.user.id,
  );
  return sendSuccess(res, {
    data: { bookmarks },
    headers: { [DATA_SOURCE_HEADER]: source },
  });
};
