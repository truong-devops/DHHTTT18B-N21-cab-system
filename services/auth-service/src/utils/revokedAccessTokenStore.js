const crypto = require("crypto");

const store = new Map();

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token || ""))
    .digest("hex");
}

function cleanupExpired() {
  const nowSec = Math.floor(Date.now() / 1000);
  for (const [key, exp] of store.entries()) {
    if (!Number.isFinite(exp) || exp <= nowSec) {
      store.delete(key);
    }
  }
}

function revokeAccessToken(token, expSec) {
  cleanupExpired();
  const hashed = hashToken(token);
  const fallbackExp = Math.floor(Date.now() / 1000) + 15 * 60;
  const exp = Number.isFinite(Number(expSec))
    ? Number(expSec)
    : fallbackExp;
  store.set(hashed, exp);
}

function isAccessTokenRevoked(token) {
  cleanupExpired();
  const hashed = hashToken(token);
  return store.has(hashed);
}

module.exports = {
  revokeAccessToken,
  isAccessTokenRevoked
};

