const { ApiError } = require('../utils/errors');

function validateRequest({ params, query, body, custom } = {}) {
  return (req, _res, next) => {
    const errors = [];

    if (params) {
      Object.entries(params).forEach(([field, validator]) => {
        const value = req.params?.[field];
        if (!validator(value)) {
          errors.push({
            path: `params.${field}`,
            message: 'is invalid'
          });
        }
      });
    }

    if (query) {
      Object.entries(query).forEach(([field, validator]) => {
        const value = req.query?.[field];
        if (value !== undefined && !validator(value)) {
          errors.push({
            path: `query.${field}`,
            message: 'is invalid'
          });
        }
      });
    }

    if (body) {
      Object.entries(body).forEach(([field, validator]) => {
        const value = req.body?.[field];
        if (!validator(value)) {
          errors.push({
            path: `body.${field}`,
            message: 'is invalid'
          });
        }
      });
    }

    if (typeof custom === 'function') {
      custom(req, errors);
    }

    if (errors.length) {
      return next(new ApiError(400, 'VALIDATION_ERROR', 'Invalid request', errors));
    }

    return next();
  };
}

module.exports = { validateRequest };
