const ALLOWED_TRANSITIONS = {
  REQUESTED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["ARRIVING", "CANCELLED"],
  ARRIVING: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"]
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
