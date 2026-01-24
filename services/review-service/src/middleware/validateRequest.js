const { validate } = require("@libs/validation");
const { ApiError } = require("../utils/errors");

function formatErrors(location, errors) {
  return errors.map((error) => ({
    path: `${location}.${error.field}`,
    message: error.message
  }));
}

function validateRequest({
  paramsSchema,
  querySchema,
  bodySchema,
  custom
} = {}) {
  return (req, _res, next) => {
    const details = [];

    if (paramsSchema) {
      const { errors } = validate(paramsSchema, req.params || {});
      details.push(...formatErrors("params", errors));
    }

    if (querySchema) {
      const { errors } = validate(querySchema, req.query || {});
      details.push(...formatErrors("query", errors));
    }

    if (bodySchema) {
      const { errors } = validate(bodySchema, req.body || {});
      details.push(...formatErrors("body", errors));
    }

    if (typeof custom === "function") {
      custom(req, details);
    }

    if (details.length) {
      return next(
        new ApiError(
          400,
          "VALIDATION_ERROR",
          "Invalid request",
          details
        )
      );
    }

    return next();
  };
}

module.exports = { validateRequest };
