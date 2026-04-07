const express = require('express');
const { createUser, getUserById, listUsers, updateUser, deleteUser } = require('../controllers/userController');
const { requireAuth, requireAdmin, requireSelfOrAdmin } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { isEmail, isUserId, ROLE_VALUES, STATUS_VALUES, isNonEmptyString, isPhone } = require('../utils/validators');

const router = express.Router();

const optional = (validator) => (value) => (value === undefined ? true : validator(value));

router.post(
  '/v1/users',
  requireAuth,
  requireAdmin,
  validateRequest({
    body: {
      email: isEmail,
      fullName: isNonEmptyString,
      phone: optional(isPhone),
      role: (value) => ROLE_VALUES.includes(String(value || '').toLowerCase()),
      status: optional((value) => STATUS_VALUES.includes(String(value || '').toUpperCase()))
    }
  }),
  createUser
);

router.get('/v1/users/:id', requireAuth, validateRequest({ params: { id: isUserId } }), requireSelfOrAdmin('id'), getUserById);

router.get(
  '/v1/users',
  requireAuth,
  requireAdmin,
  validateRequest({
    query: {
      email: optional(isEmail),
      role: optional((value) => ROLE_VALUES.includes(String(value || '').toLowerCase())),
      status: optional((value) => STATUS_VALUES.includes(String(value || '').toUpperCase())),
      limit: optional((value) => {
        const parsed = parseInt(value, 10);
        return Number.isInteger(parsed) && parsed > 0 && parsed <= 100;
      }),
      cursor: optional((value) => typeof value === 'string')
    }
  }),
  listUsers
);

router.patch(
  '/v1/users/:id',
  requireAuth,
  validateRequest({
    params: { id: isUserId },
    body: {
      email: optional(isEmail),
      fullName: optional(isNonEmptyString),
      phone: optional(isPhone),
      role: optional((value) => ROLE_VALUES.includes(String(value || '').toLowerCase())),
      status: optional((value) => STATUS_VALUES.includes(String(value || '').toUpperCase()))
    }
  }),
  requireSelfOrAdmin('id'),
  updateUser
);

router.delete('/v1/users/:id', requireAuth, requireAdmin, validateRequest({ params: { id: isUserId } }), deleteUser);

module.exports = router;
