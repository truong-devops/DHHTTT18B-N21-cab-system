const { isValidTransition, normalizeStatus } = require('../src/domain/reviewStateMachine');

describe('review state machine', () => {
  it('normalizes status to uppercase', () => {
    expect(normalizeStatus('submitted')).toBe('SUBMITTED');
    expect(normalizeStatus(null)).toBeNull();
  });

  it('accepts valid transitions', () => {
    expect(isValidTransition('SUBMITTED', 'PUBLISHED')).toBe(true);
    expect(isValidTransition('SUBMITTED', 'REJECTED')).toBe(true);
    expect(isValidTransition('PUBLISHED', 'DELETED')).toBe(true);
    expect(isValidTransition('REJECTED', 'DELETED')).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(isValidTransition('SUBMITTED', 'COMPLETED')).toBe(false);
    expect(isValidTransition('PUBLISHED', 'REJECTED')).toBe(false);
    expect(isValidTransition(null, 'PUBLISHED')).toBe(false);
  });
});
