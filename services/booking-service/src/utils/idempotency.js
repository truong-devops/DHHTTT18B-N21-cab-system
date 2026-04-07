const crypto = require('crypto');

function hashRequest(method, path, body) {
  const hash = crypto.createHash('sha256');
  hash.update(String(method || 'POST').toUpperCase());
  hash.update('|');
  hash.update(String(path || '/v1/bookings'));
  hash.update('|');
  hash.update(JSON.stringify(body || {}));
  return hash.digest('hex');
}

module.exports = { hashRequest };
