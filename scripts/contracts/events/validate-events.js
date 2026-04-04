#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../../..");
const { createEventContractRegistry } = require(path.join(
  repoRoot,
  "contracts/events/registry"
));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isStrictObjectSchema(schema) {
  return schema && schema.type === "object" && schema.additionalProperties === false;
}

function validateCatalogAndSchemas(registry) {
  const errors = [];
  const topicPattern = /^[a-z][a-z0-9]*(\.[a-z0-9]+)+$/;
  const typePattern = /^[A-Z][A-Za-z0-9]*$/;

  const schemaRoot = path.join(repoRoot, "contracts/events/schema-registry");

  for (const event of registry.catalog.events) {
    if (!topicPattern.test(event.topic)) {
      errors.push(`Invalid topic name: ${event.topic}`);
    }
    if (!typePattern.test(event.type)) {
      errors.push(`Invalid event type name: ${event.type}`);
    }

    const payloadPath = path.join(schemaRoot, event.payloadSchema);
    const envelopePath = path.join(schemaRoot, event.envelopeSchema);

    if (!fs.existsSync(payloadPath)) {
      errors.push(`Missing payload schema: ${event.payloadSchema}`);
      continue;
    }
    if (!fs.existsSync(envelopePath)) {
      errors.push(`Missing envelope schema: ${event.envelopeSchema}`);
      continue;
    }

    const payloadSchema = readJson(payloadPath);
    const envelopeSchema = readJson(envelopePath);

    if (!isStrictObjectSchema(payloadSchema)) {
      errors.push(
        `Payload schema must be strict object (additionalProperties=false): ${event.payloadSchema}`
      );
    }

    const envelopeHasAllOf = Array.isArray(envelopeSchema.allOf) && envelopeSchema.allOf.length >= 2;
    if (!envelopeHasAllOf) {
      errors.push(`Envelope schema must use allOf with common envelope: ${event.envelopeSchema}`);
    }

    const envelopeValidation = registry.validateEnvelopeByTopic(event.topic, {
      eventId: "evt_test",
      traceId: "trace_test",
      occurredAt: "2026-01-01T00:00:00.000Z",
      type: event.type,
      version: 1,
      payload: {}
    });

    if (envelopeValidation.valid) {
      errors.push(
        `Envelope schema too permissive (empty payload accepted): ${event.envelopeSchema}`
      );
    }
  }

  return errors;
}

function validateTopicsConsistency(registry) {
  const errors = [];
  const servicesDir = path.join(repoRoot, "services");
  const serviceNames = fs.readdirSync(servicesDir);

  for (const serviceName of serviceNames) {
    const topicFile = path.join(servicesDir, serviceName, "src/messaging/topics.js");
    if (!fs.existsSync(topicFile)) {
      continue;
    }

    // eslint-disable-next-line import/no-dynamic-require,global-require
    const topicConstants = require(topicFile);

    for (const event of registry.catalog.events) {
      if (!Object.prototype.hasOwnProperty.call(topicConstants, event.key)) {
        continue;
      }

      if (topicConstants[event.key] !== event.topic) {
        errors.push(
          `Topic constant mismatch in ${path.relative(repoRoot, topicFile)}: ` +
            `${event.key}=${topicConstants[event.key]} (expected ${event.topic})`
        );
      }
    }
  }

  return errors;
}

function validateExamples(registry) {
  const errors = [];
  const exampleDir = path.join(repoRoot, "contracts/events/examples");

  if (!fs.existsSync(exampleDir)) {
    return errors;
  }

  const files = fs.readdirSync(exampleDir).filter((name) => name.endsWith(".json"));
  for (const fileName of files) {
    const topic = fileName.replace(/\.example\.json$/i, "");
    const event = registry.getEntryByTopic(topic);
    if (!event) {
      errors.push(`Example has unknown topic: ${fileName}`);
      continue;
    }

    const example = readJson(path.join(exampleDir, fileName));
    const result = registry.validateEnvelopeByTopic(topic, example);
    if (!result.valid) {
      errors.push(
        `Invalid example ${fileName}: ${result.errors
          .map((item) => `${item.instancePath || "<root>"} ${item.message}`)
          .join("; ")}`
      );
    }
  }

  return errors;
}

function main() {
  const registry = createEventContractRegistry({ strict: true });

  const errors = [
    ...validateCatalogAndSchemas(registry),
    ...validateTopicsConsistency(registry),
    ...validateExamples(registry)
  ];

  if (errors.length) {
    console.error("Event contract validation failed:\n");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log("Event contract validation passed.");
}

main();
