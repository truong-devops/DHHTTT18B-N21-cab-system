const crypto = require("crypto");

function sortObjectByKey(object) {
  if (!object || typeof object !== "object" || Array.isArray(object)) {
    return object;
  }
  return Object.keys(object)
    .sort()
    .reduce((result, key) => {
      result[key] = object[key];
      return result;
    }, {});
}

function normalizeValue(value) {
  if (value === null || value === undefined || value === "null" || value === "undefined") {
    return "";
  }
  if (Array.isArray(value)) {
    const sorted = value.map((item) => sortObjectByKey(item));
    return JSON.stringify(sorted);
  }
  if (typeof value === "object") {
    return JSON.stringify(sortObjectByKey(value));
  }
  return String(value);
}

function buildSignaturePayload(data) {
  if (!data || typeof data !== "object") {
    return "";
  }
  return Object.keys(data)
    .sort()
    .map((key) => `${key}=${normalizeValue(data[key])}`)
    .join("&");
}

function signData(data, checksumKey) {
  const payload = buildSignaturePayload(data);
  return crypto.createHmac("sha256", checksumKey).update(payload).digest("hex");
}

function timingSafeEquals(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function isValidSignature(data, signature, checksumKey) {
  if (!checksumKey) {
    return false;
  }
  const expected = signData(data, checksumKey).toLowerCase();
  const actual = String(signature || "").toLowerCase();
  return timingSafeEquals(expected, actual);
}

module.exports = { signData, isValidSignature };
