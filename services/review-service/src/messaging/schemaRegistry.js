const path = require("path");
const Ajv = require("ajv");
const topics = require("./topics");

const ajv = new Ajv({ allErrors: true });
const schemaDir = path.resolve(
  __dirname,
  "../../../../contracts/events/schema-registry"
);

const topicSchemaFiles = {
  [topics.ReviewCreated]: "review.created.json"
};

function buildPayloadSchema(schema) {
  if (!schema || schema.type !== "object") {
    return { type: "object", additionalProperties: true };
  }

  const payloadSchema = JSON.parse(JSON.stringify(schema));
  if (payloadSchema.properties) {
    delete payloadSchema.properties.eventId;
    delete payloadSchema.properties.type;
  }
  if (Array.isArray(payloadSchema.required)) {
    payloadSchema.required = payloadSchema.required.filter(
      (key) => !["eventId", "type"].includes(key)
    );
  }

  return payloadSchema;
}

const validatorsByTopic = Object.entries(topicSchemaFiles).reduce(
  (acc, [topic, fileName]) => {
    const schemaPath = path.join(schemaDir, fileName);
    const rawSchema = require(schemaPath);
    acc[topic] = ajv.compile(buildPayloadSchema(rawSchema));
    return acc;
  },
  {}
);

function validatePayload(topic, payload) {
  const validator = validatorsByTopic[topic];
  if (!validator) {
    return { ok: true, errors: [] };
  }

  const ok = validator(payload);
  return { ok, errors: validator.errors || [] };
}

module.exports = { validatePayload };
