const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

test("driver-service OpenAPI includes required endpoints", () => {
  const specPath = path.resolve(
    __dirname,
    "../../../contracts/openapi/driver-service.yaml"
  );
  const spec = yaml.load(fs.readFileSync(specPath, "utf8"));
  const paths = spec.paths || {};

  assert.ok(paths["/v1/drivers"]);
  assert.ok(paths["/v1/drivers"].post);
  assert.ok(paths["/v1/drivers"].get);

  assert.ok(paths["/v1/drivers/{id}"]);
  assert.ok(paths["/v1/drivers/{id}"].get);
  assert.ok(paths["/v1/drivers/{id}"].patch);
  assert.ok(paths["/v1/drivers/{id}"].delete);

  assert.ok(paths["/v1/drivers/{id}/status"]);
  assert.ok(paths["/v1/drivers/{id}/status"].patch);

  assert.ok(paths["/v1/drivers/{id}/location"]);
  assert.ok(paths["/v1/drivers/{id}/location"].patch);
});
