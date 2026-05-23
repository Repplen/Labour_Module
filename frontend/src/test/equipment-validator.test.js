import { describe, expect, it } from "vitest";
import { calculateEquipmentRates } from "../features/equipment/helpers/equipment.helpers";
import { validateEquipmentForm } from "../features/equipment/validators/equipment.validator";

describe("equipment validator", () => {
  it("requires equipment code, name, category, and UOM", () => {
    const result = validateEquipmentForm({});

    expect(result.errors.equipmentCode).toBe("Equipment code is required.");
    expect(result.errors.equipmentName).toBe("Equipment name is required.");
    expect(result.errors.category).toBe("Equipment category is required.");
    expect(result.errors.uomId).toBe("UOM is required.");
  });

  it("validates rate and GST", () => {
    const result = validateEquipmentForm({
      equipmentCode: "EQP-001",
      equipmentName: "JCB",
      category: "Machinery",
      uomId: "uom-1",
      standardRate: "-1",
      gstPercent: "101",
    });

    expect(result.errors.standardRate).toBe("Rate must be a positive number.");
    expect(result.errors.gstPercent).toBe("GST must be between 0 and 100.");
  });

  it("calculates live equipment rates", () => {
    expect(calculateEquipmentRates({ standardRate: 1000, gstPercent: 18 })).toEqual({
      gstAmount: 180,
      grossRate: 1180,
      netRate: 1180,
    });
  });
});
