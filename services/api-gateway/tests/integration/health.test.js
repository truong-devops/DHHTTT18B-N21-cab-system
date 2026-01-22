const request = require("supertest");
const app = require("../../src/app");

describe("health endpoints", () => {
  it("responds to healthz", async () => {
    const res = await request(app).get("/healthz").expect(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("responds to readyz", async () => {
    const res = await request(app).get("/readyz").expect(200);
    expect(res.body).toEqual({ ok: true });
  });
});
