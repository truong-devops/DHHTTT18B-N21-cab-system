const DRIVER_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  SUSPENDED: 'SUSPENDED',
  DELETED: 'DELETED'
};

const ONLINE_STATUS = {
  OFFLINE: 'OFFLINE',
  ONLINE: 'ONLINE',
  BUSY: 'BUSY'
};

function canGoOnline(driverStatus) {
  return driverStatus === DRIVER_STATUS.APPROVED;
}

function canTransitionOnlineStatus(current, next, allowForceOffline) {
  if (current === next) return true;

  if (current === ONLINE_STATUS.OFFLINE && next === ONLINE_STATUS.ONLINE) {
    return true;
  }
  if (current === ONLINE_STATUS.ONLINE && next === ONLINE_STATUS.OFFLINE) {
    return true;
  }
  if (current === ONLINE_STATUS.ONLINE && next === ONLINE_STATUS.BUSY) {
    return true;
  }
  if (current === ONLINE_STATUS.BUSY && next === ONLINE_STATUS.ONLINE) {
    return true;
  }
  if (current === ONLINE_STATUS.BUSY && next === ONLINE_STATUS.OFFLINE && allowForceOffline) {
    return true;
  }

  return false;
}

module.exports = {
  DRIVER_STATUS,
  ONLINE_STATUS,
  canGoOnline,
  canTransitionOnlineStatus
};
