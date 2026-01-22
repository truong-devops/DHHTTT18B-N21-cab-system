const { validate } = require("../../../../libs/validation");

function attachScope(errors, scope) {
  return errors.map((error) => ({
    field: `${scope}.${error.field}`,
    message: error.message,
  }));
}

function validateRequest({ params, query, body }) {
  return (req, _res, next) => {
    let allErrors = [];

    if (params) {
      const result = validate(params, req.params || {});
      allErrors = allErrors.concat(attachScope(result.errors, "params"));
    }

    if (query) {
      const result = validate(query, req.query || {});
      allErrors = allErrors.concat(attachScope(result.errors, "query"));
    }

    if (body) {
      const result = validate(body, req.body || {});
      allErrors = allErrors.concat(attachScope(result.errors, "body"));
    }

    if (allErrors.length) {
      const error = new Error("Validation failed");
      error.statusCode = 400;
      error.code = "VALIDATION_ERROR";
      error.details = allErrors;
      return next(error);
    }

    return next();
  };
}

module.exports = validateRequest;
