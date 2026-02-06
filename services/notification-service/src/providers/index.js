const logger = require("../utils/logger");

function createMockProvider(channel) {
  return {
    async send(payload) {
      logger.info(
        { channel, payload },
        "[notification-service] mock send"
      );
      return { messageId: `${channel.toLowerCase()}_${Date.now()}` };
    }
  };
}

const providers = {
  EMAIL: createMockProvider("EMAIL"),
  SMS: createMockProvider("SMS"),
  PUSH: createMockProvider("PUSH"),
  IN_APP: createMockProvider("IN_APP")
};

function getProvider(channel) {
  return providers[channel];
}

module.exports = { getProvider };
