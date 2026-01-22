const { buildForwardHeaders, buildUpstreamUrl, serviceUrlForDomain } = require("./proxy-service");

describe("proxy service", () => {
  beforeEach(() => {
    delete process.env.SERVICE_AUTH_URL;
  });

  it("builds upstream url with env override", () => {
    process.env.SERVICE_AUTH_URL = "http://auth-service:3000";
    const req = { originalUrl: "/v1/auth/profile?foo=bar" };
    const url = buildUpstreamUrl(req, "auth");

    expect(url.href).toBe("http://auth-service:3000/v1/profile?foo=bar");
  });

  it("uses default service url when env is missing", () => {
    const url = serviceUrlForDomain("user");
    expect(url).toBe("http://user-service:3000");
  });

  it("forwards required headers", () => {
    const req = {
      traceId: "trace-1",
      get: (key) => {
        const map = {
          authorization: "Bearer token",
          "x-request-id": "req-1",
          "content-type": "application/json"
        };
        return map[key];
      }
    };

    const headers = buildForwardHeaders(req);
    expect(headers.authorization).toBe("Bearer token");
    expect(headers["x-trace-id"]).toBe("trace-1");
    expect(headers["x-request-id"]).toBe("req-1");
    expect(headers["content-type"]).toBe("application/json");
  });
});
