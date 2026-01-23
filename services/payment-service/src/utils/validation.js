const { ApiError } = require("./errors");
const { STATUSES } = require("../domain/paymentStatus");

function parseCreatePayment(body) {
  if (!body || typeof body !== "object") {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body is required");
  }

  const rideId = typeof body.rideId === "string" ? body.rideId.trim() : "";
  if (!rideId) {
    throw new ApiError(400, "VALIDATION_ERROR", "rideId is required");
  }

  const rawAmount = body.amount;
  const amount = typeof rawAmount === "number" ? rawAmount.toString() : String(rawAmount || "").trim();
  if (!amount || !/^\d+(\.\d{1,2})?$/.test(amount)) {
    throw new ApiError(400, "VALIDATION_ERROR", "amount must be a positive number");
  }
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "amount must be greater than zero");
  }

  const currency =
    typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "";
  if (!currency || currency.length !== 3) {
    throw new ApiError(400, "VALIDATION_ERROR", "currency must be a 3-letter code");
  }

  const method = typeof body.method === "string" ? body.method.trim().toUpperCase() : null;
  const userId = typeof body.userId === "string" ? body.userId.trim() : null;
  const note = typeof body.note === "string" ? body.note.trim() : null;

  if (method === "VIETQR" && currency !== "VND") {
    throw new ApiError(400, "VALIDATION_ERROR", "currency must be VND for VIETQR");
  }

  return { rideId, amount, currency, method, userId, note };
}

function parseStatusUpdate(body) {
  if (!body || typeof body !== "object") {
    throw new ApiError(400, "VALIDATION_ERROR", "Request body is required");
  }

  const status = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
  if (!status || !Object.values(STATUSES).includes(status)) {
    throw new ApiError(400, "VALIDATION_ERROR", "status is invalid");
  }

  const failureReason =
    typeof body.failureReason === "string" ? body.failureReason.trim() : null;
  if (status === STATUSES.FAILED && !failureReason) {
    throw new ApiError(400, "VALIDATION_ERROR", "failureReason is required for FAILED status");
  }

  return { status, failureReason };
}

function parseListQuery(query) {
  const limitRaw = Number(query.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;

  const sortRaw = typeof query.sort === "string" ? query.sort.trim() : "-createdAt";
  const sortField = sortRaw.startsWith("-") ? sortRaw.slice(1) : sortRaw;
  const sort = sortRaw.startsWith("-") ? "-createdAt" : "createdAt";
  if (sortField !== "createdAt") {
    throw new ApiError(400, "VALIDATION_ERROR", "sort must be createdAt or -createdAt");
  }

  const status = typeof query.status === "string" ? query.status.trim().toUpperCase() : null;
  const rideId = typeof query.rideId === "string" ? query.rideId.trim() : null;
  if (status && !Object.values(STATUSES).includes(status)) {
    throw new ApiError(400, "VALIDATION_ERROR", "status is invalid");
  }

  return { limit, sort, status, rideId, cursor: query.cursor || null };
}

module.exports = { parseCreatePayment, parseStatusUpdate, parseListQuery };
