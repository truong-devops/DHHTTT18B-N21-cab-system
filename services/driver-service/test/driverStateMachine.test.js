const test = require("node:test");
const assert = require("node:assert/strict");
const { canTransition } = require("../src/state/driverStateMachine");

test("allows valid driver state transitions", () => {
  assert.equal(canTransition("offline", "online"), true);
  assert.equal(canTransition("online", "offline"), true);
  assert.equal(canTransition("online", "on_trip"), true);
  assert.equal(canTransition("on_trip", "online"), true);
});

test("rejects invalid driver state transitions", () => {
  assert.equal(canTransition("offline", "on_trip"), false);
  assert.equal(canTransition("on_trip", "offline"), false);
  assert.equal(canTransition("on_trip", "on_trip"), false);
  assert.equal(canTransition("offline", "offline"), false);
});

test("rejects unknown driver state transitions", () => {
  assert.equal(canTransition("unknown", "online"), false);
  assert.equal(canTransition("online", "unknown"), false);
  assert.equal(canTransition(null, "online"), false);
});
