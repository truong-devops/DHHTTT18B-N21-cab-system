const crypto = require('crypto');
const pool = require('../db/pool');
const userRepository = require('../repository/userRepository');
const outboxRepository = require('../repository/outboxRepository');
const { ApiError } = require('../utils/errors');
const { normalizeRole, normalizeStatus } = require('../utils/validators');
const { encodeCursor, decodeCursor } = require('../utils/pagination');
const monitoring = require('../monitoring');
const { OutboxPublisher } = require('../messaging/publisher');
const { UserCreated, UserUpdated } = require('../messaging/topics');

const publisher = new OutboxPublisher(outboxRepository);

function buildUserPayload(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    fullName: user.fullName,
    phone: user.phone || null
  };
}

function buildOutboxEvent(type, user) {
  const eventId = crypto.randomUUID();
  const payload = {
    eventId,
    type,
    timestamp: new Date().toISOString(),
    user: buildUserPayload(user)
  };

  return {
    eventId,
    aggregateType: 'user',
    aggregateId: user.id,
    eventType: type,
    payload
  };
}

async function withTransaction(task) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await task(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createUser(req, res, next) {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const fullName = req.body.fullName?.trim();
    const phone = req.body.phone ? String(req.body.phone).trim() : null;
    const role = normalizeRole(req.body.role);
    const status = normalizeStatus(req.body.status) || 'ACTIVE';

    const result = await withTransaction(async (client) => {
      const user = await userRepository.createUser(client, {
        email,
        fullName,
        phone: phone || null,
        role,
        status
      });
      const event = buildOutboxEvent(UserCreated, user);
      await publisher.publish(event, client);
      return user;
    });
    monitoring.recordBusinessEvent({
      domain: 'user',
      event: 'created',
      outcome: 'success',
      attributes: {
        role: String(result.role || 'unknown').toLowerCase()
      }
    });

    return res.status(201).json({ data: result });
  } catch (error) {
    monitoring.recordBusinessEvent({
      domain: 'user',
      event: 'created',
      outcome: 'error'
    });
    return next(error);
  }
}

async function getUserById(req, res, next) {
  try {
    const user = await userRepository.getUserById(req.params.id);
    if (!user) {
      throw new ApiError(404, 'NOT_FOUND', 'User not found');
    }
    return res.json({ data: user });
  } catch (error) {
    return next(error);
  }
}

async function listUsers(req, res, next) {
  try {
    const email = req.query.email ? String(req.query.email).trim().toLowerCase() : null;
    const role = normalizeRole(req.query.role);
    const status = normalizeStatus(req.query.status);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const cursor = decodeCursor(req.query.cursor);

    const { users, nextCursor } = await userRepository.listUsers({
      email,
      role,
      status,
      limit,
      cursor
    });

    return res.json({
      data: users,
      nextCursor: nextCursor ? encodeCursor(nextCursor) : null
    });
  } catch (error) {
    return next(error);
  }
}

function buildUpdatePayload(body) {
  const payload = {};
  if (body.email !== undefined) {
    payload.email = body.email ? String(body.email).trim().toLowerCase() : null;
  }
  if (body.fullName !== undefined) {
    payload.fullName = body.fullName ? String(body.fullName).trim() : null;
  }
  if (body.phone !== undefined) {
    payload.phone = body.phone ? String(body.phone).trim() : null;
  }
  if (body.role !== undefined) {
    payload.role = normalizeRole(body.role);
  }
  if (body.status !== undefined) {
    payload.status = normalizeStatus(body.status);
  }
  return payload;
}

async function updateUser(req, res, next) {
  try {
    const update = buildUpdatePayload(req.body || {});

    if (!Object.keys(update).length) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'No fields to update');
    }

    if (req.user.role !== 'admin') {
      if (update.role || update.status) {
        throw new ApiError(403, 'FORBIDDEN', 'Cannot change role/status');
      }
    }

    const result = await withTransaction(async (client) => {
      const user = await userRepository.updateUser(client, req.params.id, update);
      if (!user) {
        throw new ApiError(404, 'NOT_FOUND', 'User not found');
      }
      const event = buildOutboxEvent(UserUpdated, user);
      await publisher.publish(event, client);
      return user;
    });
    monitoring.recordBusinessEvent({
      domain: 'user',
      event: 'updated',
      outcome: 'success'
    });

    return res.json({ data: result });
  } catch (error) {
    monitoring.recordBusinessEvent({
      domain: 'user',
      event: 'updated',
      outcome: 'error'
    });
    return next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const result = await withTransaction(async (client) => {
      const user = await userRepository.softDeleteUser(client, req.params.id);
      if (!user) {
        throw new ApiError(404, 'NOT_FOUND', 'User not found');
      }
      const event = buildOutboxEvent(UserUpdated, user);
      await publisher.publish(event, client);
      return user;
    });
    monitoring.recordBusinessEvent({
      domain: 'user',
      event: 'deleted',
      outcome: 'success'
    });

    return res.json({ data: result });
  } catch (error) {
    monitoring.recordBusinessEvent({
      domain: 'user',
      event: 'deleted',
      outcome: 'error'
    });
    return next(error);
  }
}

async function getInternalUserById(req, res, next) {
  try {
    const user = await userRepository.getUserById(req.params.id);
    if (!user) {
      throw new ApiError(404, 'NOT_FOUND', 'User not found');
    }
    return res.json({ data: user });
  } catch (error) {
    return next(error);
  }
}

async function getInternalUserByEmail(req, res, next) {
  try {
    const email = String(req.params.email).trim().toLowerCase();
    const user = await userRepository.getUserByEmail(email);
    if (!user) {
      throw new ApiError(404, 'NOT_FOUND', 'User not found');
    }
    return res.json({ data: user });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createUser,
  getUserById,
  listUsers,
  updateUser,
  deleteUser,
  getInternalUserById,
  getInternalUserByEmail
};
