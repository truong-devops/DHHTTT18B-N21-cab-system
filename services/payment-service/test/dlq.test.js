const mockSend = jest.fn(async () => undefined);
const mockProducer = {
  send: mockSend
};

jest.mock('../src/messaging/kafka', () => ({
  getProducer: jest.fn(async () => mockProducer)
}));

const { getProducer } = require('../src/messaging/kafka');
const { publishToDlq } = require('../src/messaging/dlq');

describe('payment DLQ publisher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockResolvedValue(undefined);
  });

  test('publishes dead letter envelope to *.dlq topic', async () => {
    const result = await publishToDlq({
      sourceTopic: 'ride.created',
      envelope: {
        eventId: 'evt_1',
        traceId: 'trace_1',
        type: 'RideCreated',
        payload: { rideId: 'ride_1' }
      },
      errorType: 'process_error',
      errorMessage: 'failed'
    });

    expect(getProducer).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(result.dlqTopic).toBe('ride.created.dlq');
    expect(result.dlqEnvelope.payload.sourceTopic).toBe('ride.created');
  });
});
