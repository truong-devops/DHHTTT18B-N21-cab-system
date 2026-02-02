function parseLimit(value) {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) {
    return 20;
  }
  return Math.min(limit, 100);
}

function decodeCursor(value) {
  if (!value) {
    return null;
  }
  try {
    const json = Buffer.from(value, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function parseCursorParams(query) {
  return {
    limit: parseLimit(query.limit),
    cursor: decodeCursor(query.cursor)
  };
}

module.exports = {
  parseCursorParams,
  encodeCursor
};
