const { health } = require("./health-controller");

describe("health controller", () => {
  it("returns ok true", () => {
    const res = {
      json: jest.fn()
    };

    health({}, res);

    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });
});
