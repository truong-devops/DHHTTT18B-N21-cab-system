const express = require("express");
const { validateBody } = require("../validation");
const { createDriver } = require("../controllers/driver-controller");
const { updateDriverLocation } = require("../controllers/driver-location-controller");

const router = express.Router();

router.post("/v1/drivers", validateBody("createDriverV1"), createDriver);
router.post("/v1/driver-locations", validateBody("updateDriverLocationV1"), updateDriverLocation);

module.exports = router;
