jest.mock('../src/config', () => ({
  payos: {
    autoSyncEnabled: true,
    autoSyncIntervalMs: 15000,
    autoSyncBatchSize: 20,
    clientId: 'client-id',
    apiKey: 'api-key'
  }
}));

jest.mock('../src/integrations/payosClient', () => ({
  getPaymentRequest: jest.fn()
}));

jest.mock('../src/repositories/paymentsRepo', () => ({
  listPendingPayosPayments: jest.fn()
}));

jest.mock('../src/services/paymentService', () => ({
  changePaymentStatus: jest.fn()
}));

jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  },
  withTrace: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

const config = require('../src/config');
const payosClient = require('../src/integrations/payosClient');
const paymentsRepo = require('../src/repositories/paymentsRepo');
const paymentService = require('../src/services/paymentService');
const { STATUSES } = require('../src/domain/paymentStatus');
const { mapPayosStatus, syncPayosPayment, syncPayosPaymentsBatch } = require('../src/services/payosAutoSyncService');

describe('payos auto sync service', () => {
  beforeEach(() => {
    config.payos.autoSyncEnabled = true;
    config.payos.clientId = 'client-id';
    config.payos.apiKey = 'api-key';
    config.payos.autoSyncBatchSize = 20;
    jest.clearAllMocks();
  });

  test('maps PAID PayOS status to PAID payment status', () => {
    expect(mapPayosStatus({ status: 'PAID' })).toEqual({ status: STATUSES.PAID });
  });

  test('maps CANCELLED PayOS status to FAILED payment status', () => {
    expect(mapPayosStatus({ status: 'CANCELLED', desc: 'USER_CANCELLED' })).toEqual({
      status: STATUSES.FAILED,
      failureReason: 'USER_CANCELLED'
    });
  });

  test('syncs PROCESSING payment to PAID when PayOS reports PAID', async () => {
    paymentsRepo.listPendingPayosPayments.mockResolvedValueOnce([
      {
        id: 'pay_1',
        status: STATUSES.PROCESSING,
        payos: {
          orderCode: '10001',
          paymentLinkId: 'plink_1'
        }
      }
    ]);
    payosClient.getPaymentRequest.mockResolvedValueOnce({ status: 'PAID' });
    paymentService.changePaymentStatus.mockResolvedValueOnce({
      id: 'pay_1',
      status: STATUSES.PAID
    });

    const result = await syncPayosPaymentsBatch();

    expect(result).toEqual({ skipped: false, processed: 1, synced: 1 });
    expect(payosClient.getPaymentRequest).toHaveBeenCalledWith('10001');
    expect(paymentService.changePaymentStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: 'pay_1',
        statusUpdate: { status: STATUSES.PAID },
        actor: 'payos-sync'
      })
    );
  });

  test('falls back to paymentLinkId when orderCode lookup fails', async () => {
    const payment = {
      id: 'pay_2',
      status: STATUSES.PROCESSING,
      payos: {
        orderCode: '20002',
        paymentLinkId: 'plink_2'
      }
    };
    payosClient.getPaymentRequest.mockRejectedValueOnce(new Error('not found')).mockResolvedValueOnce({ status: 'PAID' });
    paymentService.changePaymentStatus.mockResolvedValueOnce({
      id: 'pay_2',
      status: STATUSES.PAID
    });

    const result = await syncPayosPayment(payment);

    expect(result).toMatchObject({ handled: true });
    expect(payosClient.getPaymentRequest).toHaveBeenNthCalledWith(1, '20002');
    expect(payosClient.getPaymentRequest).toHaveBeenNthCalledWith(2, 'plink_2');
  });

  test('skips batch when auto sync is disabled', async () => {
    config.payos.autoSyncEnabled = false;

    const result = await syncPayosPaymentsBatch();

    expect(result).toEqual({ skipped: true, reason: 'disabled' });
    expect(paymentsRepo.listPendingPayosPayments).not.toHaveBeenCalled();
  });
});
