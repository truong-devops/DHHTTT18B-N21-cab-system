const pool = require("../db/pool");

function mapUserRow(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function getDb(client) {
  return client || pool;
}

async function createUser(client, data) {
  const db = getDb(client);
  const { rows } = await db.query(
    `INSERT INTO users (email, full_name, phone, role, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, full_name, phone, role, status, created_at, updated_at`,
    [
      data.email,
      data.fullName,
      data.phone,
      data.role,
      data.status
    ]
  );
  return mapUserRow(rows[0]);
}

async function getUserById(id, client) {
  const db = getDb(client);
  const { rows } = await db.query(
    `SELECT id, email, full_name, phone, role, status, created_at, updated_at
     FROM users
     WHERE id = $1`,
    [id]
  );
  return mapUserRow(rows[0]);
}

async function getUserByEmail(email, client) {
  const db = getDb(client);
  const { rows } = await db.query(
    `SELECT id, email, full_name, phone, role, status, created_at, updated_at
     FROM users
     WHERE email = $1`,
    [email]
  );
  return mapUserRow(rows[0]);
}

async function listUsers({ email, role, status, limit, cursor }) {
  const values = [];
  const where = [];

  if (email) {
    values.push(email);
    where.push(`email = $${values.length}`);
  }
  if (role) {
    values.push(role);
    where.push(`role = $${values.length}`);
  }
  if (status) {
    values.push(status);
    where.push(`status = $${values.length}`);
  }

  const builder = { values, where, orderBy: "", limit };
  if (cursor?.createdAt && cursor?.id) {
    builder.values.push(cursor.createdAt, cursor.id);
    const createdAtIndex = builder.values.length - 1;
    const idIndex = builder.values.length;
    builder.where.push(
      `(created_at, id) < ($${createdAtIndex}, $${idIndex})`
    );
  }

  builder.orderBy = "created_at DESC, id DESC";
  builder.limit = limit;

  const whereSql = builder.where.length
    ? `WHERE ${builder.where.join(" AND ")}`
    : "";
  builder.values.push(builder.limit);
  const limitIndex = builder.values.length;

  const { rows } = await pool.query(
    `SELECT id, email, full_name, phone, role, status, created_at, updated_at
     FROM users
     ${whereSql}
     ORDER BY ${builder.orderBy}
     LIMIT $${limitIndex}`,
    builder.values
  );

  const users = rows.map(mapUserRow);
  const last = rows[rows.length - 1];
  const nextCursor = rows.length === limit && last
    ? { createdAt: last.created_at, id: last.id }
    : null;

  return { users, nextCursor };
}

async function updateUser(client, id, fields) {
  const db = getDb(client);
  const updates = [];
  const values = [];

  const pushUpdate = (column, value) => {
    values.push(value);
    updates.push(`${column} = $${values.length}`);
  };

  if (fields.email !== undefined) {
    pushUpdate("email", fields.email);
  }
  if (fields.fullName !== undefined) {
    pushUpdate("full_name", fields.fullName);
  }
  if (fields.phone !== undefined) {
    pushUpdate("phone", fields.phone);
  }
  if (fields.role !== undefined) {
    pushUpdate("role", fields.role);
  }
  if (fields.status !== undefined) {
    pushUpdate("status", fields.status);
  }

  if (!updates.length) {
    return getUserById(id, db);
  }

  values.push(id);
  const idIndex = values.length;

  const { rows } = await db.query(
    `UPDATE users
     SET ${updates.join(", ")}
     WHERE id = $${idIndex}
     RETURNING id, email, full_name, phone, role, status, created_at, updated_at`,
    values
  );

  return mapUserRow(rows[0]);
}

async function softDeleteUser(client, id) {
  const db = getDb(client);
  const { rows } = await db.query(
    `UPDATE users
     SET status = 'DELETED'
     WHERE id = $1
     RETURNING id, email, full_name, phone, role, status, created_at, updated_at`,
    [id]
  );
  return mapUserRow(rows[0]);
}

module.exports = {
  createUser,
  getUserById,
  getUserByEmail,
  listUsers,
  updateUser,
  softDeleteUser
};
