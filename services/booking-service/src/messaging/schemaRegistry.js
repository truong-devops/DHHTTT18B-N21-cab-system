const { createEventContractRegistry } = require("../../../../contracts/events/registry");

const registry = createEventContractRegistry({ strict: true });

function validateEnvelope(topic, envelope) {
  const result = registry.validateEnvelopeByTopic(topic, envelope);
  return {
    valid: result.valid,
    errors: result.errors
  };
}

module.exports = {
  validateEnvelope
};
