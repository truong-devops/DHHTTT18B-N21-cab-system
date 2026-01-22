const pool = require("../db/pool");

const DOCUMENT_INSERT_FIELDS = [
  "driver_id",
  "document_type",
  "document_url",
  "document_id",
  "expiry_date",
  "is_verified",
  "verified_by",
  "verified_at",
  "rejection_reason",
];

const DOCUMENT_UPDATE_FIELDS = new Set([
  "document_url",
  "document_id",
  "expiry_date",
  "is_verified",
  "verified_by",
  "verified_at",
  "rejection_reason",
]);

function buildUpdateSet(data, allowedFields) {
  const entries = Object.entries(data).filter(
    ([key, value]) => allowedFields.has(key) && value !== undefined
  );
  if (entries.length === 0) {
    return { setSql: "", values: [] };
  }
  const setParts = [];
  const values = [];
  entries.forEach(([key, value], index) => {
    setParts.push(`${key} = $${index + 1}`);
    values.push(value);
  });
  return { setSql: setParts.join(", "), values };
}

async function createDriverDocument(input) {
  const columns = [];
  const placeholders = [];
  const values = [];

  DOCUMENT_INSERT_FIELDS.forEach((field) => {
    if (input[field] !== undefined) {
      columns.push(field);
      values.push(input[field]);
      placeholders.push(`$${values.length}`);
    }
  });

  const query = `
    INSERT INTO driver_documents (${columns.join(", ")})
    VALUES (${placeholders.join(", ")})
    RETURNING *;
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
}

async function getDriverDocumentById(id) {
  const result = await pool.query(
    "SELECT * FROM driver_documents WHERE id = $1;",
    [id]
  );
  return result.rows[0] || null;
}

async function listDriverDocuments({ driverId, limit = 20, cursor, sort } = {}) {
  const safeLimit = Math.min(Number(limit) || 20, 100);
  const sortDirection = sort === "created_at" ? "ASC" : "DESC";
  const conditions = [];
  const values = [];

  if (driverId) {
    values.push(driverId);
    conditions.push(`driver_id = $${values.length}`);
  }

  if (cursor) {
    values.push(cursor);
    conditions.push(`created_at ${sortDirection === "ASC" ? ">" : "<"} $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const query = `
    SELECT * FROM driver_documents
    ${whereClause}
    ORDER BY created_at ${sortDirection}
    LIMIT $${values.length + 1};
  `;

  values.push(safeLimit);
  const result = await pool.query(query, values);
  return result.rows;
}

async function updateDriverDocumentById(id, updates) {
  const { setSql, values } = buildUpdateSet(updates, DOCUMENT_UPDATE_FIELDS);
  if (!setSql) {
    return getDriverDocumentById(id);
  }
  values.push(id);
  const query = `
    UPDATE driver_documents
    SET ${setSql}
    WHERE id = $${values.length}
    RETURNING *;
  `;
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

async function deleteDriverDocumentById(id) {
  await pool.query("DELETE FROM driver_documents WHERE id = $1;", [id]);
}

module.exports = {
  createDriverDocument,
  getDriverDocumentById,
  listDriverDocuments,
  updateDriverDocumentById,
  deleteDriverDocumentById,
};
