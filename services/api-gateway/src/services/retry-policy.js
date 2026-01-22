const shouldRetry = ({ method, attempt, errorCode }) => {
  const isGet = String(method || "").toUpperCase() === "GET";
  const retryableCodes = new Set(["ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"]);
  return isGet && attempt === 0 && retryableCodes.has(errorCode);
};

module.exports = {
  shouldRetry
};
