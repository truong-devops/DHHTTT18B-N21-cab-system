function driverLocationKey(driverId) {
  return `driver:loc:${driverId}`;
}

function driverOnlineKey(driverId) {
  return `driver:online:${driverId}`;
}

function driverBusyKey(driverId) {
  return `driver:busy:${driverId}`;
}

function geoKey(vehicleType) {
  return `geo:drivers:${vehicleType || 'all'}`;
}

function locationRateKey(driverId) {
  return `driver:loc:rate:${driverId}`;
}

module.exports = {
  driverLocationKey,
  driverOnlineKey,
  driverBusyKey,
  geoKey,
  locationRateKey
};
