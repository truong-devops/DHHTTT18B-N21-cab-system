const crypto = require('crypto');

function toUser8(value) {
  if (value === undefined || value === null) {
    return '';
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return '';
  }

  if (/^\d{8}$/.test(normalized)) {
    return normalized;
  }

  const embeddedLegacyId = normalized.match(/^00000000-0000-0000-0000-0*(\d{8})$/);
  if (embeddedLegacyId) {
    return embeddedLegacyId[1];
  }

  // Keep deterministic mapping with historical SQL migration helper (map_text_to_user8).
  const hex = crypto.createHash('md5').update(normalized).digest('hex').slice(0, 8);
  const hashSeed = (parseInt(hex, 16) % 90000000) + 10000000;
  return String(hashSeed).padStart(8, '0');
}

module.exports = {
  toUser8
};
