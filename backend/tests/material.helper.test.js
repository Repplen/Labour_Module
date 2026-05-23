const {
  calculateMaterialRates,
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

  it("calculates material GST, gross, and net rates", () => {
    expect(calculateMaterialRates({ standardRate: 100, gstPercent: 18 })).toEqual({
      gstAmount: 18,
      grossRate: 118,
      netRate: 118,
    });
  });

  it("uses zero GST when GST percent is zero", () => {
    expect(calculateMaterialRates({ standardRate: 100, gstPercent: 0 })).toEqual({
      gstAmount: 0,
      grossRate: 100,
      netRate: 100,
    });
  });
});
