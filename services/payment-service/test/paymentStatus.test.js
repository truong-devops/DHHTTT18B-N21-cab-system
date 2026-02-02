const fs = require("fs");
const path = require("path");

const { STATUSES, canTransition, allowedTransitions } = require("../src/domain/paymentStatus");

function parseStateMachineTransitions(content) {
  const transitions = {};
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*(\[\*\]|[A-Z_]+)\s*-->\s*([A-Z_]+)\s*$/);
    if (!match) {
      continue;
    }
    const from = match[1];
    const to = match[2];
    if (from === "[*]") {
      continue;
    }
    if (!transitions[from]) {
      transitions[from] = [];
    }
    transitions[from].push(to);
  }
  return transitions;
}

describe("payment status transitions", () => {
  test("matches state machine contract", () => {
    const filePath = path.resolve(
      __dirname,
      "../../..",
      "contracts",
      "state-machines",
      "payment-state.mmd"
    );
    const content = fs.readFileSync(filePath, "utf8");
    const parsed = parseStateMachineTransitions(content);

    const allowedStates = Object.keys(allowedTransitions).sort();
    const parsedStates = Object.keys(parsed).sort();
    expect(parsedStates.every((state) => allowedStates.includes(state))).toBe(true);

    for (const [from, allowed] of Object.entries(allowedTransitions)) {
      const expected = parsed[from] || [];
      expect([...allowed].sort()).toEqual([...expected].sort());
    }
  });

  test("allows valid transitions", () => {
    expect(canTransition(STATUSES.INITIATED, STATUSES.PROCESSING)).toBe(true);
    expect(canTransition(STATUSES.PROCESSING, STATUSES.PAID)).toBe(true);
    expect(canTransition(STATUSES.PROCESSING, STATUSES.FAILED)).toBe(true);
    expect(canTransition(STATUSES.FAILED, STATUSES.REFUNDED)).toBe(true);
  });

  test("rejects invalid transitions", () => {
    expect(canTransition(STATUSES.INITIATED, STATUSES.PAID)).toBe(false);
    expect(canTransition(STATUSES.PAID, STATUSES.REFUNDED)).toBe(false);
  });

  test("allows idempotent transitions", () => {
    expect(canTransition(STATUSES.PAID, STATUSES.PAID)).toBe(true);
  });
});
