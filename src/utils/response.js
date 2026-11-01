export const sendSuccess = (res, { statusCode = 200, data, message, headers } = {}) => {
  if (headers) {
    res.set(headers);
  }

  const body = { status: 'success' };
  if (message !== undefined) body.message = message;
  if (data !== undefined) body.data = data;
  return res.status(statusCode).json(body);
};

export const sendFailure = (res, statusCode, message) =>
  res.status(statusCode).json({ status: 'failed', message });
