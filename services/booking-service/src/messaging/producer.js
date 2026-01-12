const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "booking-service",
  brokers: [process.env.KAFKA_BROKERS || "localhost:29092"]
});

const producer = kafka.producer();

async function publish(topic, message) {
  await producer.connect();
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(message) }]
  });
}

module.exports = { publish };
