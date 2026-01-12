const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "ride-service",
  brokers: [process.env.KAFKA_BROKERS || "localhost:29092"]
});

const consumer = kafka.consumer({ groupId: "ride-service-group" });

async function start() {
  await consumer.connect();
  await consumer.subscribe({
    topic: "ride.created",
    fromBeginning: true
  });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const value = message.value?.toString();
      console.log(
        `[ride-service] consumed topic=${topic} value=${value}`
      );
    }
  });
}

module.exports = { start };
