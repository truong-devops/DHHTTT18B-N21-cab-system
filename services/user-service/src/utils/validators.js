const ROLE_VALUES = ['admin', 'ops', 'customer', 'driver', 'user'];
const STATUS_VALUES = ['ACTIVE', 'SUSPENDED', 'DELETED'];

function isEmail(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUserId(value) {
  if (!value || typeof value !== 'string') return false;
  return /^\d{8}$/.test(value);
}

function isNonEmptyString(value) {
  if (typeof value !== 'string') {
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
  isUserId,
  isNonEmptyString,
  isPhone,
  normalizeRole,
  normalizeStatus
};
