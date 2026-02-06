function encodeCursor(createdAt, id) {
  const createdAtValue =
    createdAt instanceof Date ? createdAt.toISOString() : createdAt;
  return Buffer.from(`${createdAtValue}|${id}`).toString("base64");
}

function decodeCursor(cursor) {
  const decoded = Buffer.from(cursor, "base64").toString("utf8");
  const [createdAt, id] = decoded.split("|");
  if (!createdAt || !id) {
    return null;
  }
  return { createdAt, id };
}

module.exports = { encodeCursor, decodeCursor };
