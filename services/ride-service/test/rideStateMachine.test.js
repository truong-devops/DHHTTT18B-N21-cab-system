const { isValidTransition, normalizeStatus } = require('../src/domain/rideStateMachine');

describe('ride state machine', () => {
  it('normalizes status to uppercase', () => {
    expect(normalizeStatus('assigned')).toBe('ASSIGNED');
    expect(normalizeStatus(null)).toBeNull();
  });

  it('accepts valid transitions', () => {
    expect(isValidTransition('REQUESTED', 'ASSIGNED')).toBe(true);
    expect(isValidTransition('REQUESTED', 'COMPLETED')).toBe(true);
    expect(isValidTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
  });

  it('rejects invalid transitions', () => {
    expect(isValidTransition('REQUESTED', 'IN_PROGRESS')).toBe(false);
    expect(isValidTransition(null, 'ASSIGNED')).toBe(false);
  });
});
