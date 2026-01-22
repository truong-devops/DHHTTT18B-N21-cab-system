const TRANSITIONS = {
  offline: new Set(["online"]),
  online: new Set(["offline", "on_trip"]),
  on_trip: new Set(["online"]),
};

function canTransition(fromState, toState) {
  if (!fromState || !toState) {
    return false;
  }
  const allowed = TRANSITIONS[fromState];
  if (!allowed) {
    return false;
  }
  return allowed.has(toState);
}

module.exports = {
  canTransition,
  TRANSITIONS,
};
