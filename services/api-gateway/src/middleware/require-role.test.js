const { requireRole } = require("./require-role");
const { ForbiddenError } = require("../errors");

describe("requireRole", () => {
  it("blocks when role missing", () => {
    const req = { user: { roles: ["driver"] } };
    const next = jest.fn();

    requireRole("admin")(req, {}, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(ForbiddenError);
  });

  it("allows when role present", () => {
    const req = { user: { roles: ["admin"] } };
    const next = jest.fn();

    requireRole("admin")(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });
});
