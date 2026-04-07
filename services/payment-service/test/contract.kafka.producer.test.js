const { createEventContractRegistry } = require('../../../contracts/events/registry');
const topics = require('../src/messaging/topics');
const { buildPaymentCompleted, buildPaymentFailed } = require('../src/messaging/events');

const registry = createEventContractRegistry({ strict: true });

describe('payment producer contract', () => {
  test('PaymentCompleted envelope matches contract', () => {
    const { topic, envelope } = buildPaymentCompleted(
      {
        id: 'pay_1',
        rideId: 'ride_1',
        amount: '120000',
        currency: 'VND',
        method: 'VNPAY',
        statusUpdatedAt: '2026-01-01T00:00:00.000Z'
      },
      'trace_1'
    );

    expect(topic).toBe(topics.PaymentCompleted);
    const result = registry.validateEnvelopeByTopic(topic, envelope);
    expect(result.valid).toBe(true);
  });

  test('PaymentFailed envelope matches contract', () => {
    const { topic, envelope } = buildPaymentFailed(
      {
        id: 'pay_2',
        rideId: 'ride_2',
        amount: '99000',
        currency: 'VND',
        statusUpdatedAt: '2026-01-01T00:00:00.000Z',
        failureReason: 'gateway_timeout'
      },
      'trace_2'
    );

    expect(topic).toBe(topics.PaymentFailed);
    const result = registry.validateEnvelopeByTopic(topic, envelope);
    expect(result.valid).toBe(true);
  });
});
