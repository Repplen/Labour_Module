import { describe, expect, it } from "vitest";
import { calculateLabourPieceRates } from "../features/labourPieceWorker/helpers/labourPieceWorker.helpers";
import { validateLabourPieceWorkerForm } from "../features/labourPieceWorker/validators/labourPieceWorker.validator";

describe("labour piece worker validator", () => {
  it("requires worker code, name, type, category, rate type, and standard rate", () => {
    const result = validateLabourPieceWorkerForm({});

    expect(result.errors.workerCode).toBe("Worker code is required.");
    expect(result.errors.workerName).toBe("Worker name is required.");
    expect(result.errors.workerType).toBe("Worker type is required.");
    expect(result.errors.labourCategory).toBe("Labour category is required.");
    expect(result.errors.rateType).toBe("Rate type is required.");
    expect(result.errors.standardRate).toBe("Standard rate must be a positive number.");
  });

  it("requires UOM for piece worker", () => {
    const result = validateLabourPieceWorkerForm({
      workerCode: "PW-001",
      workerName: "Brick Work Team",
      workerType: "Piece Worker",
      labourCategory: "Contractor Team",
      rateType: "Per UOM",
      standardRate: "2500",
    });

    expect(result.errors.uomId).toBe("UOM is required for piece worker.");
  });

  it("validates GST when applicable", () => {
    const result = validateLabourPieceWorkerForm({
      workerCode: "LAB-001",
      workerName: "Mason",
      workerType: "Labour",
      labourCategory: "Skilled",
      rateType: "Per Day",
      standardRate: "1000",
      gstApplicable: true,
      gstPercent: "101",
    });

    expect(result.errors.gstPercent).toBe("GST percentage must be between 0 and 100.");
  });

  it("calculates rates with and without GST", () => {
    expect(calculateLabourPieceRates({ standardRate: 1000, gstApplicable: true, gstPercent: 18 })).toEqual({
      gstAmount: 180,
      grossRate: 1180,
      netRate: 1180,
    });
    expect(calculateLabourPieceRates({ standardRate: 1000, gstApplicable: false, gstPercent: 18 })).toEqual({
      gstAmount: 0,
      grossRate: 1000,
      netRate: 1000,
    });
  });
});
