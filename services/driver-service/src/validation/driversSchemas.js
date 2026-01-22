const VEHICLE_TYPES = ["sedan", "suv", "van", "premium", "motorcycle"];
const DRIVER_STATUSES = ["offline", "online", "on_trip", "inactive", "suspended"];
const DRIVER_STATUS_PATCH = ["offline", "online", "on_trip"];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const driverIdParamsSchema = {
  required: ["id"],
  properties: {
    id: { type: "string", pattern: UUID_REGEX },
  },
};

const listDriversQuerySchema = {
  properties: {
    limit: { type: "integer", min: 1, max: 100 },
    cursor: { type: "string" },
    sort: { type: "string", enum: ["createdAt", "-createdAt"] },
    userId: { type: "string", pattern: UUID_REGEX },
    status: { type: "string", enum: DRIVER_STATUSES },
    vehicleType: { type: "string", enum: VEHICLE_TYPES },
  },
};

const createDriverBodySchema = {
  required: [
    "licenseNumber",
    "licenseExpiryDate",
    "vehicleType",
    "vehicleBrand",
    "vehicleModel",
    "vehicleYear",
    "vehicleColor",
    "vehiclePlate",
  ],
  properties: {
    licenseNumber: { type: "string", minLength: 3, maxLength: 50 },
    licenseExpiryDate: { type: "string" },
    vehicleType: { type: "string", enum: VEHICLE_TYPES },
    vehicleBrand: { type: "string", minLength: 2, maxLength: 50 },
    vehicleModel: { type: "string", minLength: 1, maxLength: 50 },
    vehicleYear: { type: "integer", min: 2000, max: 2100 },
    vehicleColor: { type: "string", minLength: 2, maxLength: 30 },
    vehiclePlate: { type: "string", minLength: 2, maxLength: 20 },
    status: { type: "string", enum: DRIVER_STATUSES },
  },
};

const updateDriverBodySchema = {
  properties: {
    licenseNumber: { type: "string", minLength: 3, maxLength: 50 },
    licenseExpiryDate: { type: "string" },
    vehicleType: { type: "string", enum: VEHICLE_TYPES },
    vehicleBrand: { type: "string", minLength: 2, maxLength: 50 },
    vehicleModel: { type: "string", minLength: 1, maxLength: 50 },
    vehicleYear: { type: "integer", min: 2000, max: 2100 },
    vehicleColor: { type: "string", minLength: 2, maxLength: 30 },
    vehiclePlate: { type: "string", minLength: 2, maxLength: 20 },
    status: { type: "string", enum: DRIVER_STATUS_PATCH },
    currentLatitude: { type: "number", min: -90, max: 90 },
    currentLongitude: { type: "number", min: -180, max: 180 },
  },
};

const updateLocationBodySchema = {
  required: ["latitude", "longitude"],
  properties: {
    latitude: { type: "number", min: -90, max: 90 },
    longitude: { type: "number", min: -180, max: 180 },
  },
};

module.exports = {
  driverIdParamsSchema,
  listDriversQuerySchema,
  createDriverBodySchema,
  updateDriverBodySchema,
  statusOnlyBodySchema: {
    required: ["status"],
    properties: {
      status: { type: "string", enum: DRIVER_STATUS_PATCH },
    },
  },
  updateLocationBodySchema,
};
