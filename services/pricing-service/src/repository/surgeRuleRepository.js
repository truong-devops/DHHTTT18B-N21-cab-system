const crypto = require("crypto");

const DEFAULT_RULES = [
  {
    id: "sr_standard_peak",
    name: "CBD Peak",
    multiplier: 1.4,
    status: "ACTIVE",
    zone: "District 1"
  },
  {
    id: "sr_airport",
    name: "Airport Boost",
    multiplier: 1.6,
    status: "ACTIVE",
    zone: "Airport"
  },
  {
    id: "sr_late_night",
    name: "Late Night",
    multiplier: 1.2,
    status: "INACTIVE",
    zone: "All"
  }
];

function loadRulesFromEnv() {
  if (!process.env.SURGE_RULES_JSON) {
    return null;
  }
  try {
    const parsed = JSON.parse(process.env.SURGE_RULES_JSON);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch (_err) {
    return null;
  }
}

let rules = loadRulesFromEnv() || DEFAULT_RULES;

function listRules() {
  return rules;
}

function createRule(input) {
  const rule = {
    id: `sr_${crypto.randomUUID()}`,
    name: input.name,
    multiplier: Number(input.multiplier) || 1,
    status: input.status || "ACTIVE",
    zone: input.zone || "All"
  };
  rules = [rule, ...rules];
  return rule;
}

function toggleRule(id, enabled) {
  const nextStatus = enabled ? "ACTIVE" : "INACTIVE";
  const rule = rules.find((item) => item.id === id);
  if (!rule) return null;
  rule.status = nextStatus;
  return rule;
}

module.exports = { listRules, createRule, toggleRule };
