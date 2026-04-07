const CHANNEL_VALUES = ['EMAIL', 'SMS', 'PUSH', 'IN_APP'];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeChannels(channels) {
  if (!Array.isArray(channels)) {
    return { ok: false, error: 'channels must be an array' };
  }
  const normalized = channels.map((channel) => String(channel || '').toUpperCase()).filter(Boolean);
  const invalid = normalized.filter((channel) => !CHANNEL_VALUES.includes(channel));
  if (invalid.length) {
    return { ok: false, error: `invalid channels: ${invalid.join(',')}` };
  }
  const unique = Array.from(new Set(normalized));
  return { ok: true, value: unique.sort() };
}

function parseDate(value) {
  if (!value) {
    return { ok: true, value: null };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: 'scheduledAt must be a valid ISO date' };
  }
  return { ok: true, value: parsed };
}

module.exports = {
  CHANNEL_VALUES,
  isNonEmptyString,
  isObject,
  normalizeChannels,
  parseDate
};
