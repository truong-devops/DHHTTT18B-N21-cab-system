const crypto = require('crypto');

function isEightDigitId(value) {
  return typeof value === 'string' && /^\d{8}$/.test(value.trim());
}

function toUser8(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  if (isEightDigitId(normalized)) {
    return normalized;
  }

  const embeddedLegacyId = normalized.match(/^00000000-0000-0000-0000-0*(\d{8})$/);
  if (embeddedLegacyId) {
    return embeddedLegacyId[1];
  }

  const hex = crypto.createHash('md5').update(normalized).digest('hex').slice(0, 8);
  const hashSeed = (parseInt(hex, 16) % 90000000) + 10000000;
  return String(hashSeed).padStart(8, '0');
}

function toLegacyUserUuid(value) {
  const user8 = toUser8(value);
  if (!user8) {
    return null;
  }
  return `00000000-0000-0000-0000-${user8.padStart(12, '0')}`;
}

module.exports = {
  isEightDigitId,
  toUser8,
  toLegacyUserUuid
};
