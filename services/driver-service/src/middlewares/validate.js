const Ajv = require("ajv");
const { sendError } = require("../utils/error");

const ajv = new Ajv({ allErrors: true, strict: false });

function validateBody(schema) {
  const validate = ajv.compile(schema);

  return (req, res, next) => {
    const ok = validate(req.body);
    if (!ok) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Request validation failed.",
        req.traceId,
        validate.errors
      );
    }
    return next();
  };
}

module.exports = { validateBody };
