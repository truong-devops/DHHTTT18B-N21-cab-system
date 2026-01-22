const ERROR_CODE_BY_STATUS = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "RATE_LIMITED"
};

const errorCodeForStatus = (status) => ERROR_CODE_BY_STATUS[status] || "INTERNAL";

class AppError extends Error {
  constructor(message, { status = 500, code, details } = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class ValidationError extends AppError {
  constructor(message = "Validation error.", details = []) {
    super(message, { status: 400, code: "VALIDATION_ERROR", details });
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized.", details = []) {
    super(message, { status: 401, code: "UNAUTHORIZED", details });
  }
}

class ForbiddenError extends AppError {
  constructor(message = "Forbidden.", details = []) {
    super(message, { status: 403, code: "FORBIDDEN", details });
  }
}

class NotFoundError extends AppError {
  constructor(message = "Not found.", details = []) {
    super(message, { status: 404, code: "NOT_FOUND", details });
  }
}

class ConflictError extends AppError {
  constructor(message = "Conflict.", details = []) {
    super(message, { status: 409, code: "CONFLICT", details });
  }
}

class InvalidStateTransitionError extends AppError {
  constructor(message = "Invalid state transition.", details = []) {
    super(message, { status: 409, code: "INVALID_STATE_TRANSITION", details });
  }
}

class RateLimitedError extends AppError {
  constructor(message = "Rate limited.", details = []) {
    super(message, { status: 429, code: "RATE_LIMITED", details });
  }
}

class InternalError extends AppError {
  constructor(message = "Internal error.", details = []) {
    super(message, { status: 500, code: "INTERNAL", details });
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InvalidStateTransitionError,
  RateLimitedError,
  InternalError,
  errorCodeForStatus
};
