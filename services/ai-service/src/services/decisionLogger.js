const agentConfig = require('../config/agent-config.json');

const DEFAULT_MAX_ENTRIES = 1000;
const MAX_ENTRIES = Number(process.env.AI_AGENT_DECISION_BUFFER_SIZE || agentConfig.decision_log_buffer_size || DEFAULT_MAX_ENTRIES);

const entries = [];
const byTraceId = new Map();

function trimBuffer() {
  while (entries.length > MAX_ENTRIES) {
    const removed = entries.shift();
    if (!removed?.trace_id) {
      continue;
    }
    const current = byTraceId.get(removed.trace_id);
    if (current && current.id === removed.id) {
      byTraceId.delete(removed.trace_id);
    }
  }
}

function appendDecision(decision) {
  if (!decision || typeof decision !== 'object') {
    return null;
  }

  const item = {
    ...decision,
    id: decision.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    timestamp: decision.timestamp || new Date().toISOString()
  };

  entries.push(item);
  if (item.trace_id) {
    byTraceId.set(item.trace_id, item);
  }
  trimBuffer();
  return item;
}

function getDecisionByTraceId(traceId) {
  if (!traceId) {
    return null;
  }
  return byTraceId.get(traceId) || null;
}

function listRecentDecisions(limit = 20) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  return entries.slice(-safeLimit).reverse();
}

module.exports = {
  appendDecision,
  getDecisionByTraceId,
  listRecentDecisions
};
