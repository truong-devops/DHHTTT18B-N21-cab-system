const { createEventContractRegistry } = require("../../../../contracts/events/registry");

const registry = createEventContractRegistry({ strict: true });

function validatePayload(topic, payload) {
  const result = registry.validatePayloadByTopic(topic, payload);
  return {
    ok: result.valid,
    errors: result.errors
  };
}

function validateEnvelope(topic, envelope) {
  const result = registry.validateEnvelopeByTopic(topic, envelope);
  return {
    ok: result.valid,
    errors: result.errors
  };
}

module.exports = {
  validatePayload,
  validateEnvelope
};
