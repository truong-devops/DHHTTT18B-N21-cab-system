const encodeCursor = ({ createdAt, id }) => {
  if (!createdAt || !id) {
    return null;
  }
  const raw = `${createdAt}|${id}`;
  return Buffer.from(raw, "utf8").toString("base64");
};

const decodeCursor = (cursor) => {
  if (!cursor) {
    return null;
  }
  const raw = Buffer.from(cursor, "base64").toString("utf8");
  const [createdAt, id] = raw.split("|");
  if (!createdAt || !id) {
    return null;
  }
  return { createdAt, id };
};

const applyCursorQuery = (queryBuilder, { limit, cursor, sort } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const sortValue = sort || "-createdAt";
  const isDesc = sortValue.startsWith("-");
  const sortField = sortValue.replace(/^-/, "");
  const column = sortField === "createdAt" ? "created_at" : "created_at";
  const direction = isDesc ? "DESC" : "ASC";

  queryBuilder.orderBy = `${column} ${direction}, id ${direction}`;
  queryBuilder.limit = safeLimit;

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      const createdAtParam = queryBuilder.values.length + 1;
      queryBuilder.values.push(decoded.createdAt);
      const idParam = queryBuilder.values.length + 1;
      queryBuilder.values.push(decoded.id);

      const operator = isDesc ? "<" : ">";
      queryBuilder.where.push(
        `(${column} ${operator} $${createdAtParam} OR (${column} = $${createdAtParam} AND id ${operator} $${idParam}))`
      );
    }
  }

  return queryBuilder;
};

module.exports = {
  encodeCursor,
  decodeCursor,
  applyCursorQuery
};
