// const express = require("express");
// const cors = require("cors");
// const helmet = require("helmet");
// const morgan = require("morgan");

// const app = express();
// app.use(helmet());
// app.use(cors());
// app.use(express.json());
// app.use(morgan("dev"));

// app.get("/health", (_req, res) => res.json({ ok: true }));

// module.exports = app;
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const Redis = require("ioredis");
const crypto = require("crypto");

const app = express();
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));

const redis = new Redis(process.env.REDIS_URL);

const USERS = [
  { id: "admin-1", username: "admin", password: "admin123", role: "admin" },
  { id: "user-1", username: "user", password: "user123", role: "customer" }
];

const accessTTL = Number(process.env.ACCESS_TOKEN_TTL_SECONDS || 60);
const refreshTTL = Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 604800);

const refreshKey = (tid) => `refresh:${tid}`;

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, username: user.username },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: accessTTL }
  );
}

function signRefreshToken(userId, tid) {
  return jwt.sign(
    { sub: userId, tid },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: refreshTTL }
  );
}

app.get("/health", (req, res) => res.json({ ok: true }));

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  const user = USERS.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  const accessToken = signAccessToken(user);

  const tid = crypto.randomUUID();
  const refreshToken = signRefreshToken(user.id, tid);
  await redis.set(refreshKey(tid), user.id, "EX", refreshTTL);

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/refresh",
    maxAge: refreshTTL * 1000
  });

  res.json({ accessToken, user: { id: user.id, username: user.username, role: user.role } });
});

// Refresh (rotate)
app.post("/refresh", async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ message: "Missing refresh token" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  const { sub: userId, tid } = payload;
  const storedUserId = await redis.get(refreshKey(tid));
  if (!storedUserId || storedUserId !== userId) {
    return res.status(401).json({ message: "Refresh token revoked/expired" });
  }

  // rotate
  await redis.del(refreshKey(tid));
  const newTid = crypto.randomUUID();
  const newRefreshToken = signRefreshToken(userId, newTid);
  await redis.set(refreshKey(newTid), userId, "EX", refreshTTL);

  const user = USERS.find(u => u.id === userId);
  const newAccessToken = signAccessToken(user);

  res.cookie("refresh_token", newRefreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/refresh",
    maxAge: refreshTTL * 1000
  });

  res.json({ accessToken: newAccessToken });
});

app.post("/logout", (req, res) => {
  res.clearCookie("refresh_token", { path: "/refresh" });
  res.status(204).send();
});

module.exports = app;
