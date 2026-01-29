const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_EXPIRES_IN =
  process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_TOKEN_TTL_DAYS = Number(
  process.env.REFRESH_TOKEN_TTL_DAYS || 7
);
const BCRYPT_ROUNDS = Number(
  process.env.BCRYPT_ROUNDS || 10
);

function hashPassword(password) {
  const rounds = Number.isFinite(BCRYPT_ROUNDS)
    ? BCRYPT_ROUNDS
    : 10;
  return bcrypt.hash(password, rounds);
}

function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signAccessToken({ userId, role }) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT secret not configured");
  }
  const payload = {
    sub: userId,
    role,
    roles: role ? [role] : []
  };
  return jwt.sign(payload, secret, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN
  });
}

function verifyAccessToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT secret not configured");
  }
  return jwt.verify(token, secret, {
    algorithms: ["HS256"]
  });
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

function hashRefreshToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function buildRefreshExpiry(base = new Date()) {
  const expiresAt = new Date(base);
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS);
  return expiresAt;
}

module.exports = {
  hashPassword,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  buildRefreshExpiry,
  ACCESS_TOKEN_EXPIRES_IN
};
