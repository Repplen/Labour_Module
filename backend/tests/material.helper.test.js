const {
  normalizeMaterialCode,
  normalizeText,
} = require("../helpers/material.helper");

describe("material helpers", () => {
  it("normalizes material code", () => {
    expect(normalizeMaterialCode(" mat-001 ")).toBe("MAT-001");
  });

  it("normalizes material text", () => {
    expect(normalizeText("  Red   Brick ")).toBe("Red Brick");
  });
});
