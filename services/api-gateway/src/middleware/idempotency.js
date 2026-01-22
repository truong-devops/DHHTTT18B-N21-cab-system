const { createHash } = require("crypto");
const { ValidationError, ConflictError } = require("../errors");
const {
  createIdempotencyRecord,
  getIdempotencyRecord,
  updateIdempotencyStatus
} = require("../repositories/idempotency-repository");

const buildRequestHash = (req) => {
  const body = req.body && Object.keys(req.body).length > 0 ? req.body : {};
  return createHash("sha256")
    .update(`${req.method}:${req.originalUrl}:${JSON.stringify(body)}`)
    .digest("hex");
};

const idempotencyMiddleware = async (req, res, next) => {
  if (req.method !== "POST") {
    return next();
  }

  const idempotencyKey = req.get("Idempotency-Key");
  if (!idempotencyKey) {
    return next(
      new ValidationError("Idempotency-Key header is required.", [
        { field: "Idempotency-Key", message: "Required" }
      ])
    );
  }

  try {
    const requestHash = buildRequestHash(req);
    const existing = await getIdempotencyRecord(idempotencyKey);
    if (existing) {
      if (existing.request_hash && existing.request_hash !== requestHash) {
        return next(
          new ConflictError("Idempotency-Key already used with a different payload.", [
            { field: "Idempotency-Key", message: "Key reuse detected" }
          ])
        );
      }
      return next(
        new ConflictError("Idempotency-Key already used.", [
          { field: "Idempotency-Key", message: "Duplicate key" }
        ])
      );
    }

    await createIdempotencyRecord({
      idempotencyKey,
      requestHash,
      traceId: req.traceId
    });

    res.on("finish", () => {
      updateIdempotencyStatus({
        idempotencyKey,
        statusCode: res.statusCode
      });
    });

    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  idempotencyMiddleware,
  buildRequestHash
};
