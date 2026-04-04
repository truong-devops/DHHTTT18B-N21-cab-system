const { createEventContractRegistry } = require("../../../../contracts/events/registry");

const registry = createEventContractRegistry({ strict: true });

function validatePayload(type, payload) {
  const result = registry.validatePayloadByType(type, payload);
  return {
    valid: result.valid,
    errors: result.errors
  };
}

function validateEnvelope(topic, envelope) {
  const result = registry.validateEnvelopeByTopic(topic, envelope);
  return {
    valid: result.valid,
    errors: result.errors
  };
}

module.exports = {
  validatePayload,
  validateEnvelope
};
