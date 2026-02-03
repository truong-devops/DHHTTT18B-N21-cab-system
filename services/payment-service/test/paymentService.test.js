jest.mock("../src/repositories/paymentsRepo", () => ({
  getPaymentById: jest.fn(),
  updatePaymentStatus: jest.fn(),
  insertStatusHistory: jest.fn(),
  insertPayment: jest.fn(),
  listPayments: jest.fn()
}));

jest.mock("../src/repositories/outboxRepo", () => ({
  insertOutboxEvent: jest.fn()
}));

jest.mock("../src/messaging/events", () => ({
  buildPaymentCompleted: jest.fn(),
  buildPaymentFailed: jest.fn()
}));

jest.mock("../src/db/pool", () => ({
  withTransaction: jest.fn()
}));

jest.mock("../src/utils/logger", () => ({
  withTrace: jest.fn()
}));

const paymentsRepo = require("../src/repositories/paymentsRepo");
const outboxRepo = require("../src/repositories/outboxRepo");
const { buildPaymentCompleted } = require("../src/messaging/events");
const { withTransaction } = require("../src/db/pool");
const { changePaymentStatus } = require("../src/services/paymentService");
const logger = require("../src/utils/logger");
const { STATUSES } = require("../src/domain/paymentStatus");

describe("payment service transitions", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("rejects invalid transition with INVALID_STATE_TRANSITION", async () => {
    paymentsRepo.getPaymentById.mockResolvedValueOnce({
      id: "pay_1",
      status: STATUSES.INITIATED
    });

    const infoSpy = jest.fn();
    logger.withTrace.mockReturnValue({ info: infoSpy });

    await expect(
      changePaymentStatus({
        paymentId: "pay_1",
        statusUpdate: { status: STATUSES.FAILED, failureReason: "gateway_timeout" },
        traceId: "trace-1",
        requestId: "req-1",
        actor: "tester"
      })
    ).rejects.toMatchObject({
      status: 409,
      code: "INVALID_STATE_TRANSITION"
    });

    expect(logger.withTrace).toHaveBeenCalledWith("trace-1", "req-1");
    expect(infoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        fromStatus: STATUSES.INITIATED,
        toStatus: STATUSES.FAILED,
        actor: "tester",
        reason: "gateway_timeout"
      }),
      "Payment status transition"
    );
  });

  test("updates status and enqueues outbox for payment completion", async () => {
    const updated = {
      id: "pay_2",
      rideId: "ride_2",
      amount: "150.00",
      currency: "VND",
      status: STATUSES.PAID,
      statusUpdatedAt: new Date().toISOString()
    };

    paymentsRepo.getPaymentById.mockResolvedValueOnce({
      id: "pay_2",
      status: STATUSES.PROCESSING
    });
    paymentsRepo.updatePaymentStatus.mockResolvedValueOnce(updated);
    paymentsRepo.insertStatusHistory.mockResolvedValueOnce();

    buildPaymentCompleted.mockReturnValueOnce({
      topic: "payments.completed",
      envelope: {
        eventId: "evt_1",
        traceId: "trace-2",
        occurredAt: new Date().toISOString(),
        type: "PaymentCompleted",
        payload: { paymentId: "pay_2" }
      }
    });

    logger.withTrace.mockReturnValue({ info: jest.fn() });
    withTransaction.mockImplementation(async (work) => work({}));

    const result = await changePaymentStatus({
      paymentId: "pay_2",
      statusUpdate: { status: STATUSES.PAID },
      traceId: "trace-2",
      requestId: "req-2",
      actor: "system"
    });

    expect(result).toEqual(updated);
    expect(paymentsRepo.updatePaymentStatus).toHaveBeenCalledWith(
      expect.any(Object),
      "pay_2",
      STATUSES.PAID,
      undefined
    );
    expect(paymentsRepo.insertStatusHistory).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        paymentId: "pay_2",
        fromStatus: STATUSES.PROCESSING,
        toStatus: STATUSES.PAID,
        actorId: "system"
      })
    );
    expect(outboxRepo.insertOutboxEvent).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        eventId: "evt_1",
        type: "PaymentCompleted",
        topic: "payments.completed"
      })
    );
  });
});
