const pool = require("../db/pool");

async function createRefreshToken({
  userId,
  tokenHash,
  expiresAt
}) {
  const result = await pool.query(
    `
      INSERT INTO refresh_tokens (user_id, token, expired_at)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, token, expired_at, created_at
    `,
    [userId, tokenHash, expiresAt]
  );
  return result.rows[0];
}

async function findRefreshToken(tokenHash) {
  const result = await pool.query(
    `
      SELECT *
      FROM refresh_tokens
      WHERE token = $1
      LIMIT 1
    `,
    [tokenHash]
  );
  return result.rows[0] || null;
}

async function deleteRefreshToken(tokenHash) {
  await pool.query(
    `
      DELETE FROM refresh_tokens
      WHERE token = $1
    `,
    [tokenHash]
  );
}

async function deleteRefreshTokensByUser(userId) {
  await pool.query(
    `
      DELETE FROM refresh_tokens
      WHERE user_id = $1
    `,
    [userId]
  );
}

module.exports = {
  createRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
  deleteRefreshTokensByUser
};
