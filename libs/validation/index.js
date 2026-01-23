const Ajv = require("ajv");
const addFormats = require("ajv-formats");

function createAjv(options = {}) {
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    coerceTypes: true,
    useDefaults: true,
    ...options
  });
  addFormats(ajv);
  return ajv;
}

function toPath(instancePath) {
  if (!instancePath) {
    return "";
  }
  return instancePath
    .split("/")
    .filter(Boolean)
    .join(".");
}

function formatAjvErrors(errors, prefix = "") {
  if (!Array.isArray(errors)) {
    return [];
  }
  return errors.map((err) => {
    let path = toPath(err.instancePath);
    if (err.keyword === "required" && err.params && err.params.missingProperty) {
      const missing = err.params.missingProperty;
      path = path ? `${path}.${missing}` : missing;
    }
    if (err.keyword === "additionalProperties" && err.params && err.params.additionalProperty) {
      const extra = err.params.additionalProperty;
      path = path ? `${path}.${extra}` : extra;
    }
    const fullPath = prefix
      ? (path ? `${prefix}.${path}` : prefix)
      : path;
    return {
      path: fullPath || prefix || "value",
      message: err.message || "is invalid",
      keyword: err.keyword
    };
  });
}

module.exports = { createAjv, formatAjvErrors };
