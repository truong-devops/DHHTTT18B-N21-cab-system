function encodeCursor({ createdAt, id }) {
  if (!createdAt || !id) {
    return null;
  }
  const createdAtValue =
    createdAt instanceof Date
      ? createdAt.toISOString()
      : String(createdAt);
  const raw = `${createdAtValue}|${id}`;
  return Buffer.from(raw, "utf8").toString("base64");
}

function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== "string") {
    return null;
  }
  let decoded;
  try {
    decoded = Buffer.from(cursor, "base64").toString("utf8");
  } catch (error) {
    return null;
  }
  const [createdAt, id] = decoded.split("|");
  if (!createdAt || !id) {
    return null;
  }
  return { createdAt, id };
}

function applyCursorQuery(
  builder,
  { limit = 20, cursor = null, sort = "-created_at" } = {}
) {
  const sortValue = sort || "-created_at";
  const isDesc = sortValue === "-created_at";
  const order = isDesc ? "DESC" : "ASC";

  if (cursor?.createdAt && cursor?.id) {
    builder.values.push(cursor.createdAt, cursor.id);
    const createdAtIndex = builder.values.length - 1;
    const idIndex = builder.values.length;
    builder.where.push(
      `(created_at, id) ${isDesc ? "<" : ">"} ($${createdAtIndex}, $${idIndex})`
    );
  }

  builder.orderBy = `created_at ${order}, id ${order}`;
  builder.limit = limit;
  return builder;
}

module.exports = {
  encodeCursor,
  decodeCursor,
  applyCursorQuery
};
