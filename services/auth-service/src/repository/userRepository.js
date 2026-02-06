const pool = require("../db/pool");

async function createUser({
  email = null,
  username = null,
  passwordHash,
  role = "user",
  status = "active"
}) {
  const result = await pool.query(
    `
      INSERT INTO users (email, username, password_hash, role, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, username, role, status, created_at
    `,
    [email, username, passwordHash, role, status]
  );

  return result.rows[0];
}

async function findUserByIdentifier(identifier) {
  const result = await pool.query(
    `
      SELECT *
      FROM users
      WHERE email = $1 OR username = $1
      LIMIT 1
    `,
    [identifier]
  );
  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await pool.query(
    `
      SELECT id, email, username, role, status, created_at
      FROM users
      WHERE id = $1
    `,
    [id]
  );
  return result.rows[0] || null;
}

module.exports = {
  createUser,
  findUserByIdentifier,
  findUserById
};
