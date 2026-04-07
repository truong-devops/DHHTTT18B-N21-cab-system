const mockSubscribe = jest.fn(async () => undefined);
const mockRun = jest.fn(async () => undefined);
const mockConnect = jest.fn(async () => undefined);

jest.mock('kafkajs', () => ({
  Kafka: jest.fn(() => ({
    consumer: jest.fn(() => ({
      connect: mockConnect,
      subscribe: mockSubscribe,
      run: mockRun
    }))
  }))
}));

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
jest.mock('../src/cache/redis', () => ({
  get: (...args) => mockRedisGet(...args),
  set: (...args) => mockRedisSet(...args)
}));

const mockInsertInboxEvent = jest.fn();
jest.mock('../src/repository/inboxEventsRepository', () => ({
  insertInboxEvent: (...args) => mockInsertInboxEvent(...args)
}));

jest.mock('../src/messaging/schemaRegistry', () => ({
  validateEnvelope: jest.fn(() => ({ ok: true, errors: [] }))
}));

const mockPublishToDlq = jest.fn();
jest.mock('../src/messaging/producer', () => ({
  publishToDlq: (...args) => mockPublishToDlq(...args)
}));

const { start } = require('../src/messaging/consumer');

function buildMessage(envelope, offset = '0') {
  return {
    offset,
    key: Buffer.from(envelope.eventId || 'event-key'),
    value: Buffer.from(JSON.stringify(envelope))
  };
}

describe('ride consumer duplicate + commit semantics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('commits offset for duplicate event from inbox unique check', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockInsertInboxEvent.mockResolvedValueOnce(false);

    mockRun.mockImplementationOnce(async ({ eachBatch }) => {
      const resolveOffset = jest.fn();
      const commitOffsetsIfNecessary = jest.fn(async () => undefined);

      await eachBatch({
        batch: {
          topic: 'payment.completed',
          partition: 0,
          messages: [
            buildMessage({
              eventId: 'evt_dup',
              traceId: 'trace-1',
              type: 'PaymentCompleted',
              version: 1,
              payload: { rideId: 'ride_1', paymentId: 'pay_1' }
            })
          ]
        },
        resolveOffset,
        commitOffsetsIfNecessary,
        heartbeat: jest.fn(async () => undefined),
        isRunning: () => true,
        isStale: () => false
      });

      expect(resolveOffset).toHaveBeenCalledWith('0');
      expect(commitOffsetsIfNecessary).toHaveBeenCalledTimes(1);
    });

    await start();

    expect(mockInsertInboxEvent).toHaveBeenCalledTimes(1);
    expect(mockRedisSet).toHaveBeenCalledWith(expect.stringContaining('evt_dup'), '1', 'EX', expect.any(Number));
  });

  test('does not commit offset when handler throws before success', async () => {
    mockRedisGet.mockRejectedValueOnce(new Error('redis_down'));

    mockRun.mockImplementationOnce(async ({ eachBatch }) => {
      const resolveOffset = jest.fn();
      const commitOffsetsIfNecessary = jest.fn(async () => undefined);

      await expect(
        eachBatch({
          batch: {
            topic: 'payment.completed',
            partition: 1,
            messages: [
              buildMessage(
                {
                  eventId: 'evt_fail',
                  traceId: 'trace-2',
                  type: 'PaymentCompleted',
                  version: 1,
                  payload: { rideId: 'ride_2', paymentId: 'pay_2' }
                },
                '9'
              )
            ]
          },
          resolveOffset,
          commitOffsetsIfNecessary,
          heartbeat: jest.fn(async () => undefined),
          isRunning: () => true,
          isStale: () => false
        })
      ).rejects.toThrow('redis_down');

      expect(resolveOffset).not.toHaveBeenCalled();
      expect(commitOffsetsIfNecessary).not.toHaveBeenCalled();
    });

    await start();
  });
});
