function isObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function validate(schema, data) {
  const errors = [];
  const payload = data || {};
  const required = schema.required || [];
  const properties = schema.properties || {};

  required.forEach((field) => {
    if (payload[field] === undefined || payload[field] === null) {
      errors.push({ field, message: "is required" });
    }
  });

  Object.keys(properties).forEach((field) => {
    if (payload[field] === undefined || payload[field] === null) {
      return;
    }

    const rules = properties[field];
    const value = payload[field];

    if (rules.type) {
      if (rules.type === "number" && !Number.isFinite(value)) {
        errors.push({ field, message: "must be a number" });
      } else if (rules.type === "string" && typeof value !== "string") {
        errors.push({ field, message: "must be a string" });
      } else if (rules.type === "boolean" && typeof value !== "boolean") {
        errors.push({ field, message: "must be a boolean" });
      } else if (rules.type === "object" && !isObject(value)) {
        errors.push({ field, message: "must be an object" });
      }
    }

    if (rules.enum && !rules.enum.includes(value)) {
      errors.push({ field, message: "must be a valid enum value" });
    }
  });

  return { ok: errors.length === 0, errors };
}

module.exports = { validate };
