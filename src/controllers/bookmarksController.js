import { DATA_SOURCE_HEADER } from '../config/env.js';
import * as bookmarksService from '../services/bookmarksService.js';
import { sendSuccess } from '../utils/response.js';

export const postBookmark = async (req, res) => {
  const id = await bookmarksService.addBookmark(req.user.id, req.params.jobId);
  return sendSuccess(res, { statusCode: 201, data: { id } });
};

export const getBookmark = async (req, res) => {
  const { jobId, id } = req.params;
  const bookmark = await bookmarksService.getBookmarkById(id, jobId, req.user.id);
  return sendSuccess(res, { data: bookmark });
};

export const getBookmarks = async (req, res) => {
  const { data: bookmarks, source } = await bookmarksService.getBookmarksByUserId(
    req.user.id,
  );
  return sendSuccess(res, {
    data: { bookmarks },
    headers: { [DATA_SOURCE_HEADER]: source },
  });
};

export const deleteBookmark = async (req, res) => {
  await bookmarksService.deleteBookmark(req.user.id, req.params.jobId);
  return sendSuccess(res, { message: 'Bookmark berhasil dihapus' });
};
