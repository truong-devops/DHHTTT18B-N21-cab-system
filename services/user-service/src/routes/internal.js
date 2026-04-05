const express = require("express");
const {
  getInternalUserById,
  getInternalUserByEmail
} = require("../controllers/userController");
const { requireInternal } = require("../middleware/internalAuth");
const { validateRequest } = require("../middleware/validateRequest");
const { isUserId, isEmail } = require("../utils/validators");

const router = express.Router();

router.use(requireInternal);

router.get(
  "/internal/users/:id",
  validateRequest({ params: { id: isUserId } }),
  getInternalUserById
);

router.get(
  "/internal/users/by-email/:email",
  validateRequest({ params: { email: isEmail } }),
  getInternalUserByEmail
);

module.exports = router;
