const { Pool } = require("pg");

let pool;

const getPool = () => {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DB_POOL_MAX || 10)
    });
  }

  return pool;
};

module.exports = {
  getPool
};
