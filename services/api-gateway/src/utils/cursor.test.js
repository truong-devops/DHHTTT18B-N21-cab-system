const { encodeCursor, decodeCursor } = require("./cursor");

describe("cursor utils", () => {
  it("encodes and decodes cursor values", () => {
    const encoded = encodeCursor({ createdAt: "2025-01-01T00:00:00.000Z", id: "id-1" });
    const decoded = decodeCursor(encoded);

    expect(decoded).toEqual({ createdAt: "2025-01-01T00:00:00.000Z", id: "id-1" });
  });

  it("returns null for invalid cursor input", () => {
    expect(decodeCursor("aW52YWxpZA==")).toBeNull();
  });
});
