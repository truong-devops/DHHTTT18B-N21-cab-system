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
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true, service: "api-gateway" }));

function authenticateJWT(req, res, next) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return res.status(401).json({ message: "Missing token" });

  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_ACCESS_SECRET);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid/expired token" });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) return res.status(403).json({ message: "Forbidden (RBAC)" });
    return next();
  };
}

// ✅ helper forward JSON body for POST/PUT/PATCH (http-proxy-middleware v3)
function onProxyReq(proxyReq, req) {
  if (!req.body) return;

  const method = req.method?.toUpperCase();
  if (!["POST", "PUT", "PATCH"].includes(method)) return;

  const bodyData = JSON.stringify(req.body);
  proxyReq.setHeader("Content-Type", "application/json");
  proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
  proxyReq.write(bodyData);
}

// ✅ Proxy to auth-service
const authProxy = createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL,
  changeOrigin: true,
  on: {
    proxyReq: onProxyReq,
  },
});

// ✅ Proxy to user-service
const userProxy = createProxyMiddleware({
  target: process.env.USER_SERVICE_URL,
  changeOrigin: true,
  on: {
    proxyReq: onProxyReq,
  },
});

// Routes
app.use("/auth", authProxy);
app.use("/admin", authenticateJWT, requireRole("admin"), userProxy);

module.exports = app;


