const ROLE_VALUES = ["admin", "customer", "driver"];
const STATUS_VALUES = ["ACTIVE", "SUSPENDED", "DELETED"];

function isEmail(value) {
  if (!value || typeof value !== "string") {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUUID(value) {
  if (!value || typeof value !== "string") {
    return false;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isNonEmptyString(value) {
  if (typeof value !== "string") {
    return false;
  }
  return value.trim().length > 0;
}

function isPhone(value) {
  if (value === null || value === undefined) {
    return false;
  }
  const phone = String(value).trim();
  return /^[0-9+()\s-]{6,20}$/.test(phone);
}

function normalizeRole(role) {
  if (!role) {
    return null;
  }
  return String(role).toLowerCase();
}

function normalizeStatus(status) {
  if (!status) {
    return null;
  }
  return String(status).toUpperCase();
}

module.exports = {
  ROLE_VALUES,
  STATUS_VALUES,
  isEmail,
  isUUID,
  isNonEmptyString,
  isPhone,
  normalizeRole,
  normalizeStatus
};
