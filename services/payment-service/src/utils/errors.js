const ERROR_CODE_BY_STATUS = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "RATE_LIMITED"
};

function getStatus(err) {
  return err && Number.isInteger(err.status) ? err.status : 500;
}

function getCodeForStatus(status) {
  return ERROR_CODE_BY_STATUS[status] || "INTERNAL";
}

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = Number.isInteger(status) ? status : 500;
    this.code = code || getCodeForStatus(this.status);
    this.details = Array.isArray(details) ? details : [];
  }
}

function errorPayload(err, traceId) {
  const status = getStatus(err);
  const code = err && err.code ? err.code : getCodeForStatus(status);
  const hasMessage = err && typeof err.message === "string" && err.message.trim().length > 0;
  const message =
    code === "INTERNAL" && status >= 500 ? "Internal server error" : (hasMessage ? err.message : "Internal server error");
  const details = Array.isArray(err && err.details) ? err.details : [];
  const payload = { error: { code, message }, traceId };
  if (details.length) {
    payload.error.details = details;
  }
  return payload;
}

module.exports = { ApiError, errorPayload, getStatus, getCodeForStatus };
