const mockSubscribe = jest.fn();
const mockRun = jest.fn();
const mockDisconnect = jest.fn();
const mockGetConsumer = jest.fn(async () => ({
  subscribe: (...args) => mockSubscribe(...args),
  run: (...args) => mockRun(...args),
  disconnect: (...args) => mockDisconnect(...args)
}));
const mockInsertInboxEvent = jest.fn();
const mockMarkInboxProcessed = jest.fn();
const mockPublishToDlq = jest.fn();
const mockConfig = {
  kafka: {
    consumeTopics: ['ride.created'],
    partitionsConsumedConcurrently: 1,
    autoCommitInterval: 1000,
    autoCommitThreshold: 1,
    maxMessagesPerBatch: 100
  }
};

jest.mock('../src/config', () => mockConfig);

jest.mock('../src/messaging/kafka', () => ({
  getConsumer: (...args) => mockGetConsumer(...args)
}));

jest.mock('../src/repositories/inboxRepo', () => ({
  insertInboxEvent: (...args) => mockInsertInboxEvent(...args),
  markInboxProcessed: (...args) => mockMarkInboxProcessed(...args)
}));

jest.mock('../src/messaging/dlq', () => ({
  publishToDlq: (...args) => mockPublishToDlq(...args)
}));

jest.mock('../src/messaging/schemaRegistry', () => ({
  validateEnvelope: jest.fn(() => ({ valid: true, errors: [] }))
}));

const { startConsumer } = require('../src/messaging/consumer');

function buildBatchMessage(envelope, offset = '0') {
  return {
    offset,
    key: Buffer.from(envelope.eventId || 'no-key'),
    value: Buffer.from(JSON.stringify(envelope))
  };
}

describe('payment consumer duplicate + commit semantics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('commits offset for duplicate event after idempotency check', async () => {
    mockInsertInboxEvent.mockResolvedValueOnce(false);
    mockRun.mockImplementationOnce(async ({ eachBatch }) => {
      const resolveOffset = jest.fn();
      const commitOffsetsIfNecessary = jest.fn(async () => undefined);
      const heartbeat = jest.fn(async () => undefined);
      await eachBatch({
        batch: {
          topic: 'ride.created',
          partition: 0,
          messages: [
            buildBatchMessage({
              eventId: 'evt_1',
              traceId: 'trace_1',
              type: 'RideCreated',
              payload: { rideId: 'ride_1' }
            })
          ]
        },
        resolveOffset,
        commitOffsetsIfNecessary,
        heartbeat,
        isRunning: () => true,
        isStale: () => false
      });

      expect(resolveOffset).toHaveBeenCalledWith('0');
      expect(commitOffsetsIfNecessary).toHaveBeenCalledTimes(1);
    });

    await startConsumer();

    expect(mockMarkInboxProcessed).not.toHaveBeenCalled();
    expect(mockPublishToDlq).not.toHaveBeenCalled();
  });

  test('does not resolve offset when processing throws before success', async () => {
    mockInsertInboxEvent.mockRejectedValueOnce(new Error('db_unavailable'));
    mockRun.mockImplementationOnce(async ({ eachBatch }) => {
      const resolveOffset = jest.fn();
      const commitOffsetsIfNecessary = jest.fn(async () => undefined);
      const heartbeat = jest.fn(async () => undefined);

      await expect(
        eachBatch({
          batch: {
            topic: 'ride.created',
            partition: 0,
            messages: [
              buildBatchMessage({
                eventId: 'evt_2',
                traceId: 'trace_2',
                type: 'RideCreated',
                payload: { rideId: 'ride_2' }
              })
            ]
          },
          resolveOffset,
          commitOffsetsIfNecessary,
          heartbeat,
          isRunning: () => true,
          isStale: () => false
        })
      ).rejects.toThrow('db_unavailable');

      expect(resolveOffset).not.toHaveBeenCalled();
      expect(commitOffsetsIfNecessary).not.toHaveBeenCalled();
    });

    await startConsumer();
  });
});
