const { validate } = require("@libs/validation");
const { ValidationError } = require("../errors");

const mapAjvErrors = (errors, location) =>
  errors.map((error) => {
    const path = error.instancePath || "";
    const field = location ? `${location}${path}` : path || error.schemaPath || "request";
    return {
      field,
      message: error.message || "Validation error"
    };
  });

const validateBody = (schema) => (req, _res, next) => {
  const result = validate(schema, req.body || {});
  if (!result.valid) {
    return next(new ValidationError("Validation error.", mapAjvErrors(result.errors, "body")));
  }
  return next();
};

const validateQuery = (schema) => (req, _res, next) => {
  const result = validate(schema, req.query || {});
  if (!result.valid) {
    return next(new ValidationError("Validation error.", mapAjvErrors(result.errors, "query")));
  }
  return next();
};

const validateParams = (schema) => (req, _res, next) => {
  const result = validate(schema, req.params || {});
  if (!result.valid) {
    return next(new ValidationError("Validation error.", mapAjvErrors(result.errors, "params")));
  }
  return next();
};

module.exports = {
  validateBody,
  validateQuery,
  validateParams
};
