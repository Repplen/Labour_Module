import { describe, expect, it } from "vitest";
import {
  FORMULA_TYPES,
  buildOutturnPreview,
  calculateOutturnQuantity,
} from "../features/natureOfWork/helpers/natureOfWork.helpers";
import { validateNatureOfWorkForm } from "../features/natureOfWork/validators/natureOfWork.validator";

describe("nature of work frontend helpers", () => {
  it("calculates cubic metre live preview", () => {
    const input = {
      formulaType: FORMULA_TYPES.LENGTH_BREADTH_HEIGHT,
      length: 10,
      breadth: 0.23,
      height: 3,
      uomSymbol: "m³",
    };

    expect(calculateOutturnQuantity(input)).toBe(6.9);
    expect(buildOutturnPreview(input)).toBe("10 × 0.23 × 3 = 6.9 m³");
  });

  it("requires UOM when outturn is enabled without requiring measurements", () => {
    const result = validateNatureOfWorkForm(
      {
        workName: "Red Bricks",
        isWorkOutturnRequired: true,
        uomId: "",
        length: "",
        breadth: "",
        height: "",
        quantity: "",
      },
      { formulaType: FORMULA_TYPES.LENGTH_BREADTH_HEIGHT }
    );

    expect(result.errors.uomId).toBe("UOM is required.");
    expect(result.errors.breadth).toBeUndefined();
  });
});
