const ALLOWED_TRANSITIONS = {
  SUBMITTED: ["PUBLISHED", "REJECTED", "DELETED"],
  PUBLISHED: ["DELETED"],
  REJECTED: ["DELETED"]
};

function normalizeStatus(status) {
  return status ? String(status).toUpperCase() : null;
}

function isValidTransition(fromStatus, toStatus) {
  if (!fromStatus || !toStatus) {
    return false;
  }
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

module.exports = {
  ALLOWED_TRANSITIONS,
  normalizeStatus,
  isValidTransition
};
