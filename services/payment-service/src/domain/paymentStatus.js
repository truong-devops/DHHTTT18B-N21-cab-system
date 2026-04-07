const STATUSES = {
  INITIATED: 'INITIATED',
  PROCESSING: 'PROCESSING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED'
};

// Derived from contracts/state-machines/payment-state.mmd
const allowedTransitions = {
  [STATUSES.INITIATED]: [STATUSES.PROCESSING, STATUSES.FAILED],
  [STATUSES.PROCESSING]: [STATUSES.PAID, STATUSES.FAILED],
  [STATUSES.FAILED]: [STATUSES.REFUNDED],
  [STATUSES.PAID]: [],
  [STATUSES.REFUNDED]: []
};

function canTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) {
    return true;
  }
  const allowed = allowedTransitions[fromStatus] || [];
  return allowed.includes(toStatus);
}

module.exports = { STATUSES, allowedTransitions, canTransition };
