const { Kafka } = require("kafkajs");
const config = require("../config");

const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers
});

let producer;
let consumer;

async function getProducer() {
  if (!producer) {
    producer = kafka.producer();
    await producer.connect();
  }
  return producer;
}

async function getConsumer() {
  if (!consumer) {
    consumer = kafka.consumer({ groupId: config.kafka.consumerGroupId });
    await consumer.connect();
  }
  return consumer;
}

async function disconnectKafka() {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }
}

module.exports = { getProducer, getConsumer, disconnectKafka };
