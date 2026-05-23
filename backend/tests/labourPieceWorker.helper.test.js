const {
  calculateLabourPieceRates,
  normalizeText,
  normalizeWorkerCode,
} = require("../helpers/labourPieceWorker.helper");

describe("labour piece worker helpers", () => {
  it("normalizes worker code", () => {
    expect(normalizeWorkerCode(" lab-001 ")).toBe("LAB-001");
  });

  it("normalizes worker text", () => {
    expect(normalizeText("  Brick   Work Team ")).toBe("Brick Work Team");
  });

  it("calculates rates with GST", () => {
    expect(calculateLabourPieceRates({ standardRate: 1000, gstApplicable: true, gstPercent: 18 })).toEqual({
      gstAmount: 180,
      grossRate: 1180,
      netRate: 1180,
    });
  });

  it("calculates rates without GST", () => {
    expect(calculateLabourPieceRates({ standardRate: 1000, gstApplicable: false, gstPercent: 18 })).toEqual({
      gstAmount: 0,
      grossRate: 1000,
      netRate: 1000,
    });
  });
});
