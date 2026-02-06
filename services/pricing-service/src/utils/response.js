function buildMeta(req) {
  return {
    requestId: req.requestId || null,
    traceId: req.traceId || null
  };
}

function sendSuccess(res, req, data, status = 200) {
  return res.status(status).json({
    success: true,
    data,
    meta: buildMeta(req)
  });
}

module.exports = { sendSuccess, buildMeta };
