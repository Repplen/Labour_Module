const {
  calculateAndDescribeOutturn,
  buildTree,
} = require("../helpers/natureOfWork.helper");
const { FORMULA_TYPES } = require("../helpers/uom.helper");

describe("natureOfWork helpers", () => {
  it("calculates cubic metre outturn and preview", () => {
    const result = calculateAndDescribeOutturn({
      formulaType: FORMULA_TYPES.LENGTH_BREADTH_HEIGHT,
      length: 10,
      breadth: 0.23,
      height: 3,
      uomSymbol: "m³",
    });

    expect(result.totalQuantity).toBe(6.9);
    expect(result.outturnDescription).toBe("10 × 0.23 × 3 = 6.9 m³");
  });

  it("calculates square metre outturn", () => {
    const result = calculateAndDescribeOutturn({
      formulaType: FORMULA_TYPES.LENGTH_BREADTH,
      length: 10,
      breadth: 3,
      uomSymbol: "m²",
    });

    expect(result.totalQuantity).toBe(30);
    expect(result.outturnDescription).toBe("10 × 3 = 30 m²");
  });

  it("calculates quantity outturn", () => {
    const result = calculateAndDescribeOutturn({
      formulaType: FORMULA_TYPES.QUANTITY,
      quantity: 500,
      uomSymbol: "No.",
    });

    expect(result.totalQuantity).toBe(500);
    expect(result.outturnDescription).toBe("500 No.");
  });

  it("builds a multi-level tree", () => {
    const rows = [
      { _id: "1", workName: "Brick Work", parentWorkId: null, path: "Brick Work" },
      { _id: "2", workName: "Red Bricks", parentWorkId: "1", path: "Brick Work / Red Bricks" },
      { _id: "3", workName: "External Wall", parentWorkId: "2", path: "Brick Work / Red Bricks / External Wall" },
    ];

    const tree = buildTree(rows);

    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children[0].workName).toBe("External Wall");
  });
});
