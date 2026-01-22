const fs = require("fs");
const path = require("path");
const YAML = require("yaml");
const request = require("supertest");
const jestOpenAPI =
  require("jest-openapi").default || require("jest-openapi");
const app = require("../../src/app");

const specPath = path.resolve(
  __dirname,
  "../../../../contracts/openapi/api-gateway.yaml"
);
const spec = YAML.parse(fs.readFileSync(specPath, "utf8"));

describe("api-gateway contract", () => {
  beforeAll(() => {
    expect(spec).toBeTruthy();
    jestOpenAPI(spec);
  });

  it("matches /healthz response schema", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
  });

  it("matches /readyz response schema", async () => {
    const res = await request(app).get("/readyz");
    expect(res.status).toBe(200);
    expect(res).toSatisfyApiSpec();
  });
});
