#!/usr/bin/env node
const { execSync } = require('child_process');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--base-ref' && argv[i + 1]) {
      args.baseRef = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function tryRun(cmd) {
  try {
    return run(cmd);
  } catch (_error) {
    return null;
  }
}

function parseJsonFromGit(ref, filePath) {
  const content = tryRun(`git show ${ref}:${filePath}`);
  if (content == null) {
    return null;
  }
  return JSON.parse(content);
}

function normalizeType(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
}

function isTypeSuperset(oldSchema, nextSchema) {
  const oldTypes = normalizeType(oldSchema.type);
  const nextTypes = normalizeType(nextSchema.type);
  if (!oldTypes.length || !nextTypes.length) {
    return true;
  }
  return oldTypes.every((item) => nextTypes.includes(item));
}

function comparePrimitiveConstraints(oldSchema, nextSchema, path, errors) {
  if (oldSchema.pattern && nextSchema.pattern !== oldSchema.pattern) {
    errors.push(`${path}: pattern changed from ${oldSchema.pattern} to ${nextSchema.pattern || 'none'}`);
  }
  if (oldSchema.format && nextSchema.format !== oldSchema.format) {
    errors.push(`${path}: format changed from ${oldSchema.format} to ${nextSchema.format || 'none'}`);
  }

  if (oldSchema.minLength != null && (nextSchema.minLength == null || nextSchema.minLength > oldSchema.minLength)) {
    errors.push(`${path}: minLength tightened (${oldSchema.minLength} -> ${nextSchema.minLength})`);
  }
  if (oldSchema.maxLength != null && (nextSchema.maxLength == null || nextSchema.maxLength < oldSchema.maxLength)) {
    errors.push(`${path}: maxLength tightened (${oldSchema.maxLength} -> ${nextSchema.maxLength})`);
  }

  if (oldSchema.minimum != null && (nextSchema.minimum == null || nextSchema.minimum > oldSchema.minimum)) {
    errors.push(`${path}: minimum tightened (${oldSchema.minimum} -> ${nextSchema.minimum})`);
  }
  if (oldSchema.maximum != null && (nextSchema.maximum == null || nextSchema.maximum < oldSchema.maximum)) {
    errors.push(`${path}: maximum tightened (${oldSchema.maximum} -> ${nextSchema.maximum})`);
  }
}

function compareEnumsAndConst(oldSchema, nextSchema, path, errors) {
  if (oldSchema.const !== undefined) {
    if (nextSchema.const !== undefined && nextSchema.const !== oldSchema.const) {
      errors.push(`${path}: const changed (${oldSchema.const} -> ${nextSchema.const})`);
    } else if (Array.isArray(nextSchema.enum) && !nextSchema.enum.includes(oldSchema.const)) {
      errors.push(`${path}: enum no longer accepts old const ${oldSchema.const}`);
    }
  }

  if (Array.isArray(oldSchema.enum)) {
    if (nextSchema.const !== undefined) {
      if (!oldSchema.enum.includes(nextSchema.const)) {
        errors.push(`${path}: const ${nextSchema.const} not compatible with old enum`);
      }
    } else if (Array.isArray(nextSchema.enum)) {
      const missing = oldSchema.enum.filter((item) => !nextSchema.enum.includes(item));
      if (missing.length) {
        errors.push(`${path}: enum removed values ${missing.join(', ')}`);
      }
    } else {
      errors.push(`${path}: enum removed`);
    }
  }
}

function compareSchemas(oldSchema, nextSchema, path, errors) {
  if (!oldSchema || !nextSchema) {
    return;
  }

  compareEnumsAndConst(oldSchema, nextSchema, path, errors);

  if (!isTypeSuperset(oldSchema, nextSchema)) {
    errors.push(`${path}: type narrowed (${JSON.stringify(oldSchema.type)} -> ${JSON.stringify(nextSchema.type)})`);
  }

  comparePrimitiveConstraints(oldSchema, nextSchema, path, errors);

  if (oldSchema.type === 'object' || (Array.isArray(oldSchema.type) && oldSchema.type.includes('object'))) {
    const oldRequired = new Set(oldSchema.required || []);
    const nextRequired = new Set(nextSchema.required || []);
    for (const key of nextRequired) {
      if (!oldRequired.has(key)) {
        errors.push(`${path}: added required field '${key}'`);
      }
    }

    const oldProps = oldSchema.properties || {};
    const nextProps = nextSchema.properties || {};

    for (const oldKey of Object.keys(oldProps)) {
      if (!Object.prototype.hasOwnProperty.call(nextProps, oldKey)) {
        errors.push(`${path}: removed property '${oldKey}'`);
        continue;
      }
      compareSchemas(oldProps[oldKey], nextProps[oldKey], `${path}.${oldKey}`, errors);
    }

    const oldAdditional = oldSchema.additionalProperties;
    const nextAdditional = nextSchema.additionalProperties;
    if ((oldAdditional === true || oldAdditional === undefined) && nextAdditional === false) {
      errors.push(`${path}: additionalProperties tightened (true -> false)`);
    }
  }

  if (oldSchema.type === 'array' || (Array.isArray(oldSchema.type) && oldSchema.type.includes('array'))) {
    if (oldSchema.items && nextSchema.items) {
      compareSchemas(oldSchema.items, nextSchema.items, `${path}[]`, errors);
    }
  }
}

function detectBaseRef() {
  const args = parseArgs(process.argv);
  if (args.baseRef) {
    return args.baseRef;
  }
  if (process.env.EVENT_CONTRACT_BASE_REF) {
    return process.env.EVENT_CONTRACT_BASE_REF;
  }
  if (process.env.GITHUB_BASE_REF) {
    return `origin/${process.env.GITHUB_BASE_REF}`;
  }
  return 'HEAD~1';
}

function main() {
  const baseRef = detectBaseRef();
  const resolvedBase = tryRun(`git rev-parse --verify ${baseRef}`);
  if (!resolvedBase) {
    console.log(`Skip backward compatibility check: base ref not found (${baseRef}).`);
    process.exit(0);
  }

  const oldCatalog = parseJsonFromGit(baseRef, 'contracts/events/catalog.json');
  if (!oldCatalog) {
    console.log('No previous contracts/events/catalog.json found. Nothing to compare.');
    process.exit(0);
  }

  const nextCatalog = require('../../../contracts/events/catalog.json');
  const errors = [];

  const nextEventsByTopic = new Map((nextCatalog.events || []).map((event) => [event.topic, event]));

  for (const oldEvent of oldCatalog.events || []) {
    const nextEvent = nextEventsByTopic.get(oldEvent.topic);
    if (!nextEvent) {
      errors.push(`Removed topic from catalog: ${oldEvent.topic}`);
      continue;
    }
    if (nextEvent.type !== oldEvent.type) {
      errors.push(`Type changed for topic ${oldEvent.topic}: ${oldEvent.type} -> ${nextEvent.type}`);
    }

    const oldPayload = parseJsonFromGit(baseRef, `contracts/events/schema-registry/${oldEvent.payloadSchema}`);
    if (!oldPayload) {
      continue;
    }

    const nextPayload = require(`../../../contracts/events/schema-registry/${nextEvent.payloadSchema}`);
    compareSchemas(oldPayload, nextPayload, `${oldEvent.topic}.payload`, errors);
  }

  if (errors.length) {
    console.error('Event contract backward compatibility check failed:\n');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('Event contract backward compatibility check passed.');
}

main();
