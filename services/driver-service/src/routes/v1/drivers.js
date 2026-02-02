const express = require("express");
const { validateBody } = require("../../middlewares/validate");
const { sendError } = require("../../utils/error");
const driverService = require("../../services/driver.service");
const createSchema = require("../../schemas/driver.create.json");
const updateSchema = require("../../schemas/driver.update.json");
const { parseCursorParams, encodeCursor } = require("../../utils/pagination");

const router = express.Router();

router.post("/", validateBody(createSchema), (req, res) => {
  const result = driverService.createDriver(req.body);
  if (!result.ok) {
    return sendError(
      res,
      409,
      result.error,
      "Driver already exists.",
      req.traceId
    );
  }
  return res.status(201).json(result.driver);
});

router.get("/", (req, res) => {
  const { limit, cursor } = parseCursorParams(req.query);
  const list = driverService.listDrivers({ limit, cursor });
  const nextCursor = list.nextCursor
    ? encodeCursor(list.nextCursor)
    : null;
  return res.json({
    data: list.items,
    nextCursor
  });
});

router.get("/:driverId", (req, res) => {
  const driver = driverService.getDriver(req.params.driverId);
  if (!driver) {
    return sendError(
      res,
      404,
      "DRIVER_NOT_FOUND",
      "Driver not found.",
      req.traceId
    );
  }
  return res.json(driver);
});

router.patch(
  "/:driverId",
  validateBody(updateSchema),
  (req, res) => {
    const result = driverService.updateDriver(
      req.params.driverId,
      req.body
    );
    if (!result.ok) {
      return sendError(
        res,
        404,
        "DRIVER_NOT_FOUND",
        "Driver not found.",
        req.traceId
      );
    }
    return res.json(result.driver);
  }
);

module.exports = router;
