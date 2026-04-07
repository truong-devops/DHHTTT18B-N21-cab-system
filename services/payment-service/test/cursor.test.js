const { encodeCursor, decodeCursor } = require('../../../libs/http/cursor');

describe('cursor utilities', () => {
  test('round trips cursor values', () => {
    const createdAt = new Date().toISOString();
    const id = 'pay_123';
    const cursor = encodeCursor({ createdAt, id });
    const decoded = decodeCursor(cursor);
    expect(decoded.createdAt).toBe(createdAt);
    expect(decoded.id).toBe(id);
  });

  test('throws on invalid cursor', () => {
    expect(() => decodeCursor('invalid')).toThrow('Cursor is invalid');
  });
});
