import { describe, expect, it } from "vitest";
import { calculateMaterialRates } from "../features/material/helpers/material.helpers";
import { validateMaterialForm } from "../features/material/validators/material.validator";

describe("material validator", () => {
  it("requires material code, name, category, and UOM", () => {
    const result = validateMaterialForm({});

    expect(result.errors.materialCode).toBe("Material code is required.");
    expect(result.errors.materialName).toBe("Material name is required.");
    expect(result.errors.category).toBe("Material category is required.");
    expect(result.errors.uomId).toBe("UOM is required.");
  });

  it("validates rate and GST", () => {
    const result = validateMaterialForm({
      materialCode: "MAT-001",
      materialName: "Cement",
      category: "Cement",
      uomId: "uom-1",
      standardRate: "-1",
      gstPercent: "101",
    });

    expect(result.errors.standardRate).toBe("Standard rate must be a positive number.");
    expect(result.errors.gstPercent).toBe("GST percentage must be between 0 and 100.");
  });

  it("calculates live material rates", () => {
    expect(calculateMaterialRates({ standardRate: 100, gstPercent: 18 })).toEqual({
      gstAmount: 18,
      grossRate: 118,
      netRate: 118,
    });
  });
});
