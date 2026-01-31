const { updateDriverLocationV1 } = require("../driver-store");
const { publishDriverLocationUpdated } = require("../producers/driver-location-updated");

function updateDriverLocation(req, res) {
  const { driverId, lat, lng } = req.body;
  const driver = updateDriverLocationV1(driverId, { lat, lng });
  if (!driver) {
    return res.status(404).json({ error: "Driver not found" });
  }
  publishDriverLocationUpdated({
    driverId,
    location: { lat, lng }
  });
  return res.status(200).json({
    driverId,
    location: { lat, lng },
    updatedAt: driver.updatedAt
  });
}

module.exports = {
  updateDriverLocation
};
