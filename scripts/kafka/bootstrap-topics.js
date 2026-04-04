#!/usr/bin/env node
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "../..");
const catalog = require(path.join(repoRoot, "contracts/events/catalog.json"));
const topicPolicy = require(path.join(repoRoot, "infra/kafka/topic-policy.json"));

function parseIntEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function getComposeArgs() {
  const files = (process.env.KAFKA_COMPOSE_FILES || "infra/docker-compose.dev.yml")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const profiles = (process.env.KAFKA_COMPOSE_PROFILES || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const args = [];
  files.forEach((file) => {
    args.push("-f", file);
  });
  profiles.forEach((profile) => {
    args.push("--profile", profile);
  });

  return args;
}

function runDockerCompose(composeArgs, args, options = {}) {
  const fullArgs = ["compose", ...composeArgs, ...args];
  const result = spawnSync("docker", fullArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit"
  });

  if (result.status !== 0 && !options.allowFailure) {
    const stderr = result.stderr || "";
    throw new Error(`docker compose ${args.join(" ")} failed: ${stderr.trim()}`);
  }

  return result;
}

function detectBrokerService(composeArgs) {
  if (process.env.KAFKA_BOOTSTRAP_SERVICE) {
    return process.env.KAFKA_BOOTSTRAP_SERVICE;
  }

  const result = runDockerCompose(
    composeArgs,
    ["ps", "--services", "--status", "running"],
    { capture: true, allowFailure: true }
  );
  const services = (result.stdout || "")
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);

  if (services.includes("kafka-1")) {
    return "kafka-1";
  }
  if (services.includes("kafka")) {
    return "kafka";
  }

  return "kafka";
}

function waitForBroker(composeArgs, serviceName, bootstrapServer) {
  const attempts = parseIntEnv("KAFKA_BOOTSTRAP_WAIT_ATTEMPTS", 30);
  const sleepMs = parseIntEnv("KAFKA_BOOTSTRAP_WAIT_MS", 2000);

  for (let i = 1; i <= attempts; i += 1) {
    const probe = runDockerCompose(
      composeArgs,
      [
        "exec",
        "-T",
        serviceName,
        "kafka-broker-api-versions",
        "--bootstrap-server",
        bootstrapServer
      ],
      { capture: true, allowFailure: true }
    );

    if (probe.status === 0) {
      return;
    }

    const until = Date.now() + sleepMs;
    while (Date.now() < until) {}
  }

  throw new Error(
    `Kafka bootstrap server ${bootstrapServer} is not ready after ${attempts} attempts`
  );
}

function buildTopicSpecs() {
  const defaults = topicPolicy.defaults || {};

  const defaultPartitions = parseIntEnv(
    "KAFKA_TOPIC_DEFAULT_PARTITIONS",
    Number(defaults.partitions || 3)
  );
  const defaultReplicationFactor = parseIntEnv(
    "KAFKA_TOPIC_RF",
    Number(defaults.replicationFactor || 1)
  );
  const defaultMinIsr = parseIntEnv(
    "KAFKA_TOPIC_MIN_ISR",
    Number(defaults.minInSyncReplicas || 1)
  );
  const defaultRetentionMs = parseIntEnv(
    "KAFKA_TOPIC_RETENTION_MS",
    Number(defaults.retentionMs || 604800000)
  );
  const defaultSegmentMs = parseIntEnv(
    "KAFKA_TOPIC_SEGMENT_MS",
    Number(defaults.segmentMs || 3600000)
  );

  const mainTopics = new Set([
    ...(catalog.events || []).map((event) => event.topic),
    ...Object.keys(topicPolicy.topics || {})
  ]);

  const specs = [];

  for (const topic of mainTopics) {
    const override = topicPolicy.topics?.[topic] || {};
    const partitions = Number(override.partitions || defaultPartitions);
    const replicationFactor = Number(
      override.replicationFactor || defaultReplicationFactor
    );

    specs.push({
      topic,
      partitions,
      replicationFactor,
      configs: {
        "cleanup.policy": override.cleanupPolicy || defaults.cleanupPolicy || "delete",
        "retention.ms": Number(override.retentionMs || defaultRetentionMs),
        "segment.ms": Number(override.segmentMs || defaultSegmentMs),
        "min.insync.replicas": Number(override.minInSyncReplicas || defaultMinIsr)
      }
    });

    if (topicPolicy.retry?.enabled !== false) {
      const retryRf = parseIntEnv("KAFKA_RETRY_TOPIC_RF", replicationFactor);
      const retryMinIsr = parseIntEnv(
        "KAFKA_RETRY_TOPIC_MIN_ISR",
        Math.min(retryRf, defaultMinIsr)
      );
      const tiers = topicPolicy.retry?.tiers || [];

      tiers.forEach((tier) => {
        specs.push({
          topic: `${topic}.${tier.suffix}`,
          partitions,
          replicationFactor: retryRf,
          configs: {
            "cleanup.policy": "delete",
            "retention.ms": Number(tier.retentionMs),
            "segment.ms": Number(tier.segmentMs || defaultSegmentMs),
            "min.insync.replicas": Number(tier.minInSyncReplicas || retryMinIsr)
          }
        });
      });
    }

    if (topicPolicy.dlq?.enabled !== false) {
      const dlqRf = parseIntEnv("KAFKA_DLQ_TOPIC_RF", replicationFactor);
      const dlqMinIsr = parseIntEnv(
        "KAFKA_DLQ_TOPIC_MIN_ISR",
        Math.min(dlqRf, defaultMinIsr)
      );
      specs.push({
        topic: `${topic}.dlq`,
        partitions,
        replicationFactor: dlqRf,
        configs: {
          "cleanup.policy": "delete",
          "retention.ms": Number(topicPolicy.dlq.retentionMs || defaultRetentionMs),
          "segment.ms": Number(topicPolicy.dlq.segmentMs || defaultSegmentMs),
          "min.insync.replicas": Number(topicPolicy.dlq.minInSyncReplicas || dlqMinIsr)
        }
      });
    }
  }

  return specs;
}

function upsertTopic(composeArgs, serviceName, bootstrapServer, spec) {
  runDockerCompose(composeArgs, [
    "exec",
    "-T",
    serviceName,
    "kafka-topics",
    "--bootstrap-server",
    bootstrapServer,
    "--create",
    "--if-not-exists",
    "--topic",
    spec.topic,
    "--partitions",
    String(spec.partitions),
    "--replication-factor",
    String(spec.replicationFactor)
  ]);

  runDockerCompose(
    composeArgs,
    [
      "exec",
      "-T",
      serviceName,
      "kafka-topics",
      "--bootstrap-server",
      bootstrapServer,
      "--alter",
      "--if-exists",
      "--topic",
      spec.topic,
      "--partitions",
      String(spec.partitions)
    ],
    { allowFailure: true }
  );

  const configPairs = Object.entries(spec.configs)
    .map(([key, value]) => `${key}=${value}`)
    .join(",");

  runDockerCompose(composeArgs, [
    "exec",
    "-T",
    serviceName,
    "kafka-configs",
    "--bootstrap-server",
    bootstrapServer,
    "--alter",
    "--entity-type",
    "topics",
    "--entity-name",
    spec.topic,
    "--add-config",
    configPairs
  ]);
}

function main() {
  const composeArgs = getComposeArgs();
  const serviceName = detectBrokerService(composeArgs);
  const bootstrapServer =
    process.env.KAFKA_BOOTSTRAP_SERVER ||
    (serviceName === "kafka" ? "kafka:9092" : `${serviceName}:9092`);

  console.log(`[kafka-bootstrap] using compose args: ${composeArgs.join(" ") || "<default>"}`);
  console.log(`[kafka-bootstrap] broker service: ${serviceName}`);
  console.log(`[kafka-bootstrap] bootstrap server: ${bootstrapServer}`);

  waitForBroker(composeArgs, serviceName, bootstrapServer);

  const specs = buildTopicSpecs();
  for (const spec of specs) {
    console.log(
      `[kafka-bootstrap] apply ${spec.topic} partitions=${spec.partitions} rf=${spec.replicationFactor}`
    );
    upsertTopic(composeArgs, serviceName, bootstrapServer, spec);
  }

  console.log("[kafka-bootstrap] done.");
}

main();
