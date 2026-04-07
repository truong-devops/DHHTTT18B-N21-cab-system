const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const catalog = require('./catalog.json');

const SCHEMA_BASE_PATH = path.resolve(__dirname, 'schema-registry');

function readJson(relativePath) {
  const absolutePath = path.join(SCHEMA_BASE_PATH, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function normalizeAjvErrors(errors) {
  return (errors || []).map((error) => ({
    keyword: error.keyword,
    instancePath: error.instancePath || '',
    message: error.message || 'invalid'
  }));
}

function normalizeCatalogEntries(entries) {
  const seenTopics = new Set();
  const seenTypes = new Set();

  entries.forEach((entry) => {
    if (seenTopics.has(entry.topic)) {
      throw new Error(`Duplicate topic in event catalog: ${entry.topic}`);
    }
    if (seenTypes.has(entry.type)) {
      throw new Error(`Duplicate type in event catalog: ${entry.type}`);
    }
    seenTopics.add(entry.topic);
    seenTypes.add(entry.type);
  });

  return entries;
}

function createEventContractRegistry(options = {}) {
  const strict = options.strict !== false;
  const entries = normalizeCatalogEntries([...(catalog.events || [])]);

  const ajv = new Ajv({
    allErrors: true,
    strict,
    strictRequired: strict,
    validateFormats: true
  });
  addFormats(ajv);

  const envelopeCommon = readJson('envelopes/envelope.common.schema.json');
  ajv.addSchema(envelopeCommon, envelopeCommon.$id);

  const payloadValidatorsByTopic = new Map();
  const payloadValidatorsByType = new Map();
  const envelopeValidatorsByTopic = new Map();
  const entriesByTopic = new Map();
  const entriesByType = new Map();

  entries.forEach((entry) => {
    const payloadSchema = readJson(entry.payloadSchema);
    const envelopeSchema = readJson(entry.envelopeSchema);

    ajv.addSchema(payloadSchema, payloadSchema.$id);
    ajv.addSchema(envelopeSchema, envelopeSchema.$id);

    payloadValidatorsByTopic.set(entry.topic, ajv.getSchema(payloadSchema.$id));
    payloadValidatorsByType.set(entry.type, ajv.getSchema(payloadSchema.$id));
    envelopeValidatorsByTopic.set(entry.topic, ajv.getSchema(envelopeSchema.$id));
    entriesByTopic.set(entry.topic, entry);
    entriesByType.set(entry.type, entry);
  });

  function validatePayloadByTopic(topic, payload) {
    const validator = payloadValidatorsByTopic.get(topic);
    if (!validator) {
      return {
        valid: false,
        errors: [{ keyword: 'topic', instancePath: '', message: `unknown topic: ${topic}` }]
      };
    }
    const valid = validator(payload);
    return { valid, errors: normalizeAjvErrors(validator.errors) };
  }

  function validatePayloadByType(type, payload) {
    const validator = payloadValidatorsByType.get(type);
    if (!validator) {
      return {
        valid: false,
        errors: [{ keyword: 'type', instancePath: '', message: `unknown event type: ${type}` }]
      };
    }
    const valid = validator(payload);
    return { valid, errors: normalizeAjvErrors(validator.errors) };
  }

  function validateEnvelopeByTopic(topic, envelope) {
    const validator = envelopeValidatorsByTopic.get(topic);
    const entry = entriesByTopic.get(topic);

    if (!validator || !entry) {
      return {
        valid: false,
        errors: [{ keyword: 'topic', instancePath: '', message: `unknown topic: ${topic}` }]
      };
    }

    if (!envelope || envelope.type !== entry.type) {
      return {
        valid: false,
        errors: [
          {
            keyword: 'type',
            instancePath: '/type',
            message: `type must be ${entry.type} for topic ${topic}`
          }
        ]
      };
    }

    const valid = validator(envelope);
    return { valid, errors: normalizeAjvErrors(validator.errors) };
  }

  return {
    catalog: {
      version: catalog.version || 1,
      events: entries
    },
    getEntryByTopic: (topic) => entriesByTopic.get(topic) || null,
    getEntryByType: (type) => entriesByType.get(type) || null,
    validatePayloadByTopic,
    validatePayloadByType,
    validateEnvelopeByTopic
  };
}

module.exports = {
  createEventContractRegistry,
  normalizeAjvErrors
};
