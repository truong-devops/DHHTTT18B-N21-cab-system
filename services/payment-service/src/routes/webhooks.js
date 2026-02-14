const express = require("express");

const { asyncHandler } = require("../utils/asyncHandler");
const { payosWebhookController } = require("../controllers/payosWebhookController");

const router = express.Router();

router.post("/payos", asyncHandler(payosWebhookController));

module.exports = router;
