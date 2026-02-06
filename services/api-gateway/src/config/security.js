function parseList(raw, fallback = []) {
  if (!raw) {
    return fallback;
  }
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_ALGORITHMS = parseList(
  process.env.JWT_ALGORITHMS,
  ["HS256"]
);

const PUBLIC_DOMAINS = new Set(
  parseList(process.env.AUTH_PUBLIC_DOMAINS, ["auth"])
);
const PUBLIC_PATHS = new Set(
  parseList(process.env.AUTH_PUBLIC_PATHS, [
    "/health",
    "/healthz",
    "/readyz"
  ])
);

module.exports = {
  JWT_SECRET,
  JWT_ALGORITHMS,
  PUBLIC_DOMAINS,
  PUBLIC_PATHS
};
