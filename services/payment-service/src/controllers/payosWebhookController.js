const { handlePayosWebhook } = require('../services/payosWebhookService');

async function payosWebhookController(req, res) {
  const result = await handlePayosWebhook(req.body);
  res.json({ ok: true, handled: result.handled });
}

module.exports = { payosWebhookController };
