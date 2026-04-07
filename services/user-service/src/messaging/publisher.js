class Publisher {
  async publish() {
    throw new Error('Not implemented');
  }
}

class OutboxPublisher extends Publisher {
  constructor(outboxRepository) {
    super();
    this.outboxRepository = outboxRepository;
  }

  async publish(event, client) {
    return this.outboxRepository.insertEvent(client, event);
  }
}

module.exports = { Publisher, OutboxPublisher };
