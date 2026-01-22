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

module.exports = {
  encodeCursor,
  decodeCursor
};
