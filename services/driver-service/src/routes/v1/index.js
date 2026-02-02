const express = require("express");
const requireAuth = require("../../middlewares/requireAuth");
const driversRouter = require("./drivers");
const driverLocationsRouter = require("./driverLocations");

const router = express.Router();

router.use(requireAuth);
router.use("/drivers", driversRouter);
router.use("/driver-locations", driverLocationsRouter);

module.exports = router;
