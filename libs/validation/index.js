function validate(schema, data) {
  const errors = [];
  const value = data || {};
  const required = schema.required || [];
  const properties = schema.properties || {};

  required.forEach((field) => {
    if (value[field] === undefined || value[field] === null) {
      errors.push({ field, message: "is required" });
    }
  });

  Object.entries(properties).forEach(([field, rules]) => {
    const fieldValue = value[field];
    if (fieldValue === undefined || fieldValue === null) {
      return;
    }

    if (rules.type) {
      const type = rules.type;
      const isArray = Array.isArray(fieldValue);
      if (type === "array" && !isArray) {
        errors.push({ field, message: "must be an array" });
        return;
      }
      if (type !== "array" && typeof fieldValue !== type) {
        const isNumber = type === "number" && typeof fieldValue === "number";
        const isInteger = type === "integer" && Number.isInteger(fieldValue);
        if (!isNumber && !isInteger) {
          errors.push({ field, message: `must be a ${type}` });
          return;
        }
      }
      if (type === "integer" && !Number.isInteger(fieldValue)) {
        errors.push({ field, message: "must be an integer" });
        return;
      }
    }

    if (rules.enum && !rules.enum.includes(fieldValue)) {
      errors.push({ field, message: "is not allowed" });
    }

    if (typeof fieldValue === "number") {
      if (rules.min !== undefined && fieldValue < rules.min) {
        errors.push({ field, message: `min is ${rules.min}` });
      }
      if (rules.max !== undefined && fieldValue > rules.max) {
        errors.push({ field, message: `max is ${rules.max}` });
      }
    }

    if (typeof fieldValue === "string") {
      if (rules.minLength && fieldValue.length < rules.minLength) {
        errors.push({ field, message: `min length is ${rules.minLength}` });
      }
      if (rules.maxLength && fieldValue.length > rules.maxLength) {
        errors.push({ field, message: `max length is ${rules.maxLength}` });
      }
      if (rules.pattern && !rules.pattern.test(fieldValue)) {
        errors.push({ field, message: "format is invalid" });
      }
    }
  });

  return { value, errors };
}

module.exports = { validate };
