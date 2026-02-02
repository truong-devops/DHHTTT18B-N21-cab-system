const topics = require("./topics");

let producer = null;
let kafkaEnabled = false;

async function initProducerIfNeeded() {
  if (producer || kafkaEnabled === false) {
    return;
  }
  try {
    const { Kafka } = require("kafkajs");
    const kafka = new Kafka({
      clientId: "driver-service",
      brokers: [process.env.KAFKA_BROKERS || "localhost:29092"]
    });
    producer = kafka.producer();
    await producer.connect();
  } catch (err) {
    console.warn("[driver-service] kafka disabled:", err.message);
    producer = null;
  }
}

function isKafkaEnabled() {
  return (process.env.KAFKA_ENABLED || "").toLowerCase() === "true";
}

async function publishDriverLocationUpdated(event) {
  const payload = JSON.stringify(event);

  if (!isKafkaEnabled()) {
    console.log(
      `[driver-service] event ${topics.DriverLocationUpdated} ${payload}`
    );
    return { published: false };
  }

  kafkaEnabled = true;
  await initProducerIfNeeded();

  if (!producer) {
    return { published: false };
  }

  await producer.send({
    topic: topics.DriverLocationUpdated,
    messages: [{ value: payload }]
  });

  return { published: true };
}

module.exports = { publishDriverLocationUpdated };
