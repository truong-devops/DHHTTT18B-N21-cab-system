const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const schemaBasePath = path.resolve(
  __dirname,
  "../../../../contracts/events/schema-registry"
);

const schemaMap = {
  PaymentCompleted: "payment.completed.json",
  PaymentFailed: "payment.failed.json"
};

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validators = Object.entries(schemaMap).reduce((acc, [type, filename]) => {
  const schemaPath = path.join(schemaBasePath, filename);
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  acc[type] = ajv.compile(schema);
  return acc;
}, {});

function validatePayload(type, payload) {
  const validator = validators[type];
  if (!validator) {
    return { valid: true, errors: [] };
  }
  const valid = validator(payload);
  return { valid, errors: validator.errors || [] };
}

module.exports = { validatePayload };
