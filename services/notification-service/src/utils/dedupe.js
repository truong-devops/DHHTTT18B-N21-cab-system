const crypto = require('crypto');

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function buildDedupeKey(payload) {
  const raw = stableStringify(payload);
  return crypto.createHash('sha256').update(raw).digest('hex');
}

module.exports = { buildDedupeKey };
