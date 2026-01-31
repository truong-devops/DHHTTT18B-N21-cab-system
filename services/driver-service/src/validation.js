const Ajv = require("ajv");

const locationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["lat", "lng"],
  properties: {
    lat: { type: "number", minimum: -90, maximum: 90 },
    lng: { type: "number", minimum: -180, maximum: 180 }
  }
};

const schemas = {
  createDriver: {
    type: "object",
    additionalProperties: false,
    required: ["driverId", "name", "phone", "status", "location"],
    properties: {
      driverId: { type: "string", minLength: 1, maxLength: 64 },
      name: { type: "string", minLength: 1, maxLength: 200 },
      phone: { type: "string", minLength: 3, maxLength: 32 },
      status: { type: "string", enum: ["offline", "available", "on_trip"] },
      location: locationSchema
    }
  },
  createDriverV1: {
    type: "object",
    additionalProperties: false,
    required: ["fullName", "phoneNumber"],
    properties: {
      fullName: { type: "string" },
      phoneNumber: { type: "string" }
    }
  },
  updateDriverLocationV1: {
    type: "object",
    additionalProperties: false,
    required: ["driverId", "lat", "lng"],
    properties: {
      driverId: { type: "string" },
      lat: { type: "number", minimum: -90, maximum: 90 },
      lng: { type: "number", minimum: -180, maximum: 180 }
    }
  },
  updateDriverStatus: {
    type: "object",
    additionalProperties: false,
    required: ["status"],
    properties: {
      status: { type: "string", enum: ["offline", "available", "on_trip"] }
    }
  },
  updateDriverLocation: {
    type: "object",
    additionalProperties: false,
    required: ["lat", "lng"],
    properties: {
      lat: { type: "number", minimum: -90, maximum: 90 },
      lng: { type: "number", minimum: -180, maximum: 180 }
    }
  }
};

const ajv = new Ajv({ allErrors: true, strict: false });
const validators = Object.fromEntries(
  Object.entries(schemas).map(([name, schema]) => [name, ajv.compile(schema)])
);

function validateBody(schemaName) {
  return (req, res, next) => {
    const validate = validators[schemaName];
    if (!validate) {
      const err = new Error("Schema not found");
      err.status = 500;
      err.code = "INTERNAL_ERROR";
      return next(err);
    }
    const valid = validate(req.body);
    if (!valid) {
      const err = new Error("Validation failed");
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      err.expose = true;
      err.details = validate.errors.map((issue) => ({
        path: issue.instancePath || "/",
        message: issue.message
      }));
      return next(err);
    }
    return next();
  };
}

module.exports = {
  validateBody,
  schemas
};
