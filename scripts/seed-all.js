#!/usr/bin/env node

const path = require("path");
const { spawnSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const DEFAULT_COMPOSE_FILE = "infra/docker-compose.dev.yml";

const DRIVER_ID = "99999999-9999-9999-9999-999999999999";
const DRIVER_LOCATION = {
  lat: 10.7765,
  lng: 106.7009,
  heading: 120,
  speed: 12.5,
  accuracy: 8
};

function parseArgs(argv) {
  const options = {
    composeFile: DEFAULT_COMPOSE_FILE
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--compose-file" || arg === "-f") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("Missing value for --compose-file");
      }
      options.composeFile = next;
      i += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function run(command, args, { cwd = ROOT_DIR, allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    encoding: "utf8"
  });

  if (result.error) {
    throw result.error;
  }
  if (!allowFailure && result.status !== 0) {
    throw new Error(
      `Command failed (${result.status}): ${command} ${args.join(" ")}`
    );
  }

  return result;
}

function runCapture(command, args, { cwd = ROOT_DIR } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8"
  });

  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error || null
  };
}

function sleep(ms) {
  const signal = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(signal, 0, 0, ms);
}

function waitUntil({
  name,
  checkFn,
  attempts = 30,
  delayMs = 2000
}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (checkFn()) {
      return;
    }
    process.stdout.write(
      `[seed-all] waiting for ${name} (${attempt}/${attempts})...\n`
    );
    sleep(delayMs);
  }

  throw new Error(`Timeout waiting for ${name}`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      [
        "Usage: node scripts/seed-all.js [--compose-file <path>]",
        "",
        "Seeds all backend data stores used by the platform:",
        "- PostgreSQL (auth/user/driver/review/payment)",
        "- MongoDB (ride/notification)",
        "- Redis (driver presence + pricing quotes)"
      ].join("\n")
    );
    return;
  }

  const composeFilePath = path.resolve(ROOT_DIR, options.composeFile);
  const composeBaseArgs = ["compose", "-f", composeFilePath];
  const compose = (args, runOptions) =>
    run("docker", [...composeBaseArgs, ...args], runOptions);
  const composeCheck = (args) =>
    runCapture("docker", [...composeBaseArgs, ...args]);

  process.stdout.write("[seed-all] starting dependencies (postgres, mongo, redis)...\n");
  compose(["up", "-d", "postgres", "mongo", "redis"]);

  waitUntil({
    name: "postgres",
    checkFn: () => {
      const result = composeCheck([
        "exec",
        "-T",
        "postgres",
        "pg_isready",
        "-U",
        "cab",
        "-d",
        "cab_booking"
      ]);
      return result.status === 0;
    }
  });

  waitUntil({
    name: "mongo",
    checkFn: () => {
      const result = composeCheck([
        "exec",
        "-T",
        "mongo",
        "mongosh",
        "--quiet",
        "--eval",
        "db.runCommand({ ping: 1 }).ok"
      ]);
      return result.status === 0 && result.stdout.includes("1");
    }
  });

  waitUntil({
    name: "redis",
    checkFn: () => {
      const result = composeCheck([
        "exec",
        "-T",
        "redis",
        "redis-cli",
        "PING"
      ]);
      return result.status === 0 && result.stdout.toUpperCase().includes("PONG");
    }
  });

  process.stdout.write("[seed-all] seeding PostgreSQL...\n");
  compose([
    "exec",
    "-T",
    "postgres",
    "psql",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    "cab",
    "-d",
    "cab_booking",
    "-f",
    "/docker-entrypoint-initdb.d/01-create-service-databases.sql"
  ]);
  compose([
    "exec",
    "-T",
    "postgres",
    "psql",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    "cab",
    "-d",
    "cab_booking",
    "-f",
    "/docker-entrypoint-initdb.d/02-seed-dev-data.sql"
  ]);

  process.stdout.write("[seed-all] seeding MongoDB...\n");
  compose([
    "exec",
    "-T",
    "mongo",
    "mongosh",
    "--quiet",
    "--file",
    "/docker-entrypoint-initdb.d/01-seed-dev-data.js"
  ]);

  process.stdout.write("[seed-all] seeding Redis...\n");
  const nowIso = new Date().toISOString();
  const locationPayload = JSON.stringify({
    ...DRIVER_LOCATION,
    ts: nowIso
  });

  const quote1 = JSON.stringify({
    quoteId: "quote_seed_001",
    serviceType: "STANDARD",
    pickup: { lat: 10.776, lng: 106.701 },
    dropoff: { lat: 10.783, lng: 106.694 },
    estimatedFare: 85000,
    currency: "VND",
    distanceKm: 6.2,
    durationMin: 18,
    expiresAt: new Date(Date.now() + 300000).toISOString()
  });
  const quote2 = JSON.stringify({
    quoteId: "quote_seed_002",
    serviceType: "PREMIUM",
    pickup: { lat: 10.771, lng: 106.703 },
    dropoff: { lat: 10.764, lng: 106.697 },
    estimatedFare: 120000,
    currency: "VND",
    distanceKm: 7.1,
    durationMin: 20,
    expiresAt: new Date(Date.now() + 300000).toISOString()
  });

  compose([
    "exec",
    "-T",
    "redis",
    "redis-cli",
    "SET",
    `driver:online:${DRIVER_ID}`,
    "ONLINE",
    "EX",
    "300"
  ]);
  compose([
    "exec",
    "-T",
    "redis",
    "redis-cli",
    "DEL",
    `driver:busy:${DRIVER_ID}`
  ]);
  compose([
    "exec",
    "-T",
    "redis",
    "redis-cli",
    "SET",
    `driver:loc:${DRIVER_ID}`,
    locationPayload,
    "EX",
    "180"
  ]);
  compose([
    "exec",
    "-T",
    "redis",
    "redis-cli",
    "GEOADD",
    "geo:drivers:all",
    String(DRIVER_LOCATION.lng),
    String(DRIVER_LOCATION.lat),
    DRIVER_ID
  ]);
  compose([
    "exec",
    "-T",
    "redis",
    "redis-cli",
    "GEOADD",
    "geo:drivers:CAR",
    String(DRIVER_LOCATION.lng),
    String(DRIVER_LOCATION.lat),
    DRIVER_ID
  ]);
  compose([
    "exec",
    "-T",
    "redis",
    "redis-cli",
    "SET",
    "quote:quote_seed_001",
    quote1,
    "EX",
    "300"
  ]);
  compose([
    "exec",
    "-T",
    "redis",
    "redis-cli",
    "SET",
    "quote:quote_seed_002",
    quote2,
    "EX",
    "300"
  ]);

  process.stdout.write(
    [
      "[seed-all] done.",
      "[seed-all] booking-service keeps seed data in-memory at startup (services/booking-service/src/seed/bookings.js)."
    ].join("\n")
  );
}

try {
  main();
} catch (error) {
  process.stderr.write(`[seed-all] failed: ${error.message}\n`);
  process.exit(1);
}
