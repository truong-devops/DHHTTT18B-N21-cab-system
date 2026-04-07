const crypto = require('crypto');

function hashRequest(method, path, body) {
  const hash = crypto.createHash('sha256');
  hash.update(method.toUpperCase());
  hash.update('|');
  hash.update(path);
  hash.update('|');
  hash.update(JSON.stringify(body || {}));
  return hash.digest('hex');
}

module.exports = { hashRequest };
