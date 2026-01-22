const Ajv = require("ajv");

const ajv = new Ajv({ allErrors: true, strict: false, coerceTypes: true });
const validators = new Map();

const getValidator = (schema) => {
  const key = JSON.stringify(schema);
  if (validators.has(key)) {
    return validators.get(key);
  }
  const validate = ajv.compile(schema);
  validators.set(key, validate);
  return validate;
};

const validate = (schema, data) => {
  const validator = getValidator(schema);
  const valid = validator(data);
  return {
    valid,
    errors: validator.errors || []
  };
};

module.exports = {
  validate
};
