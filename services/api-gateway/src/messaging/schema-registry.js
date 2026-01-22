const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");

const defaultSchemaPath = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "contracts",
  "events",
  "schema-registry"
);

class SchemaRegistry {
  constructor({ basePath = defaultSchemaPath } = {}) {
    this.basePath = basePath;
    this.ajv = new Ajv({ allErrors: true, strict: false });
    this.validators = new Map();
  }

  getValidator(type) {
    if (this.validators.has(type)) {
      return this.validators.get(type);
    }

    const schemaPath = path.join(this.basePath, `${type}.json`);
    const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
    const validate = this.ajv.compile(schema);
    this.validators.set(type, validate);
    return validate;
  }

  validatePayload(type, payload) {
    const validate = this.getValidator(type);
    const valid = validate(payload);
    return {
      valid,
      errors: validate.errors || []
    };
  }
}

module.exports = {
  SchemaRegistry
};
