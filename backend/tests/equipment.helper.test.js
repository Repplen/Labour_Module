const {
  calculateEquipmentRates,
  normalizeEquipmentCode,
  normalizeText,
} = require("../helpers/equipment.helper");

describe("equipment helpers", () => {
  it("normalizes equipment code", () => {
    expect(normalizeEquipmentCode(" eqp-001 ")).toBe("EQP-001");
  });

  it("normalizes equipment text", () => {
    expect(normalizeText("  Concrete   Mixer ")).toBe("Concrete Mixer");
  });

  it("calculates equipment GST, gross, and net rates", () => {
    expect(calculateEquipmentRates({ standardRate: 1000, gstPercent: 18 })).toEqual({
      gstAmount: 180,
      grossRate: 1180,
      netRate: 1180,
    });
  });

  it("uses zero GST when GST percent is zero", () => {
    expect(calculateEquipmentRates({ standardRate: 1000, gstPercent: 0 })).toEqual({
      gstAmount: 0,
      grossRate: 1000,
      netRate: 1000,
    });
  });
});
