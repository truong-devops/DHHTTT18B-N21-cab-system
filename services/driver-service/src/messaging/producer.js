const { Kafka } = require("kafkajs");

let producer;

function getProducer() {
  if (producer) {
    return producer;
  }
  const brokers = (process.env.KAFKA_BROKERS || "localhost:9092")
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);
  const kafka = new Kafka({
    clientId: process.env.SERVICE_NAME || "driver-service",
    brokers,
  });
  producer = kafka.producer();
  return producer;
}

async function publishMessage({ topic, key, value, headers }) {
  const kafkaProducer = getProducer();
  await kafkaProducer.connect();
  await kafkaProducer.send({
    topic,
    messages: [
      {
        key,
        value: JSON.stringify(value),
        headers,
      },
    ],
  });
}

module.exports = {
  publishMessage,
};
