class CursorError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
    this.code = "VALIDATION_ERROR";
  }
}

const DEFAULT_SORT = "-createdAt";

function normalizeSort(sort) {
  const raw = typeof sort === "string" && sort.trim() ? sort.trim() : DEFAULT_SORT;
  const isDesc = raw.startsWith("-");
  const field = isDesc ? raw.slice(1) : raw;
  if (field !== "createdAt") {
    throw new CursorError("sort must be createdAt or -createdAt");
  }
  return { sort: isDesc ? "-createdAt" : "createdAt", direction: isDesc ? "DESC" : "ASC" };
}

function encodeCursor({ createdAt, id }) {
  if (!createdAt || !id) {
    throw new CursorError("Cursor is invalid");
  }
  const createdAtValue = createdAt instanceof Date ? createdAt.toISOString() : String(createdAt);
  const idValue = String(id);
  if (!createdAtValue || !idValue) {
    throw new CursorError("Cursor is invalid");
  }
  return Buffer.from(`${createdAtValue}|${idValue}`).toString("base64");
}

function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== "string") {
    throw new CursorError("Cursor is invalid");
  }
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const parts = decoded.split("|");
    if (parts.length !== 2) {
      throw new Error("Invalid cursor format");
    }
    const createdAt = parts[0];
    const id = parts[1];
    if (!createdAt || !id) {
      throw new Error("Invalid cursor content");
    }
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Invalid cursor timestamp");
    }
    return { createdAt, id };
  } catch (err) {
    throw new CursorError("Cursor is invalid");
  }
}

function normalizeCursor(cursor) {
  if (!cursor) {
    return null;
  }
  const value = typeof cursor === "string" ? decodeCursor(cursor) : cursor;
  if (!value || typeof value !== "object") {
    throw new CursorError("Cursor is invalid");
  }
  const createdAtValue =
    value.createdAt instanceof Date ? value.createdAt.toISOString() : String(value.createdAt || "");
  const idValue = String(value.id || "");
  if (!createdAtValue || !idValue) {
    throw new CursorError("Cursor is invalid");
  }
  const date = new Date(createdAtValue);
  if (Number.isNaN(date.getTime())) {
    throw new CursorError("Cursor is invalid");
  }
  return { createdAt: createdAtValue, id: idValue, date };
}

function applyCursorQuery(builder, { limit, cursor, sort }) {
  const { direction } = normalizeSort(sort);
  builder.orderBy = `ORDER BY created_at ${direction}, id ${direction}`;

  const cursorValue = normalizeCursor(cursor);
  if (cursorValue) {
    builder.values.push(cursorValue.date);
    builder.values.push(cursorValue.id);
    const createdAtIndex = builder.values.length - 1;
    const idIndex = builder.values.length;
    const condition =
      direction === "ASC"
        ? `(created_at > $${createdAtIndex} OR (created_at = $${createdAtIndex} AND id > $${idIndex}))`
        : `(created_at < $${createdAtIndex} OR (created_at = $${createdAtIndex} AND id < $${idIndex}))`;
    builder.where.push(condition);
  }

  const rawLimit = Number(limit);
  const safeLimit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;
  builder.values.push(safeLimit + 1);

  return { limit: safeLimit, sortDirection: direction, cursor: cursorValue };
}

module.exports = { encodeCursor, decodeCursor, applyCursorQuery };
