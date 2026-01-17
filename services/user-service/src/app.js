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
const jwt = require("jsonwebtoken");

const app = express();
app.use(helmet());
app.use(express.json());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));

app.get("/health", (req, res) => res.json({ ok: true }));

function authenticateJWT(req, res, next) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return res.status(401).json({ message: "Missing token" });
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_ACCESS_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid/expired token" });
  }
}

app.get("/admin/summary", authenticateJWT, (req, res) => {
  res.json({
    viewer: { id: req.user.sub, username: req.user.username, role: req.user.role },
    kpi: { totalUsers: 1234, totalDrivers: 321, ridesToday: 56, revenueToday: 12500000 },
    lastUpdated: new Date().toISOString()
  });
});

module.exports = app;
