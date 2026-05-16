const {
  designationBodySchema,
  designationNameSchema,
} = require("../validators/designation.validator");

// ─── Helper ───────────────────────────────────────────────────────────────────

const parse = (schema, input) => {
  const result = schema.safeParse(input);
  const issues = result.success ? [] : result.error?.issues ?? result.error?.errors ?? [];
  return {
    success: result.success,
    data: result.success ? result.data : undefined,
    firstError: issues[0]?.message,
    errors: issues,
  };
};

// ═════════════════════════════════════════════════════════════════════════════
// 1. designationNameSchema  (isolated name-field tests)
// ═════════════════════════════════════════════════════════════════════════════

describe("designationNameSchema", () => {
  describe("valid inputs", () => {
    const validNames = [
      "Software Engineer",
      "HR Manager",
      "Officer123",
      "Lead-Admin",
      "AB",               // minimum 2 chars
      "X".repeat(100),   // exactly 100 chars
      "  Trimmed Name  ", // whitespace trimmed by preprocess
      "123",             // digits only
    ];

    test.each(validNames)("accepts: %s", (name) => {
      expect(parse(designationNameSchema, name).success).toBe(true);
    });

    test("trims surrounding whitespace", () => {
      const { data } = parse(designationNameSchema, "  Software Engineer  ");
      expect(data).toBe("Software Engineer");
    });

    test("collapses internal whitespace", () => {
      const { data } = parse(designationNameSchema, "HR  Manager");
      expect(data).toBe("HR Manager");
    });
  });

  describe("rejects empty / whitespace-only input", () => {
    test("rejects empty string", () => {
      const { success, firstError } = parse(designationNameSchema, "");
      expect(success).toBe(false);
      expect(firstError).toMatch(/required/i);
    });

    test("rejects whitespace-only string", () => {
      const { success, firstError } = parse(designationNameSchema, "   ");
      expect(success).toBe(false);
      expect(firstError).toMatch(/required/i);
    });
  });

  describe("rejects names that are too short", () => {
    test("rejects single character", () => {
      const { success, firstError } = parse(designationNameSchema, "A");
      expect(success).toBe(false);
      expect(firstError).toMatch(/at least 2/i);
    });

    test("rejects 1 char after trim", () => {
      const { success } = parse(designationNameSchema, " A ");
      expect(success).toBe(false);
    });
  });

  describe("rejects names that are too long", () => {
    test("rejects 101 characters", () => {
      const { success, firstError } = parse(designationNameSchema, "A".repeat(101));
      expect(success).toBe(false);
      expect(firstError).toMatch(/100/);
    });

    test("accepts exactly 100 characters", () => {
      expect(parse(designationNameSchema, "A".repeat(100)).success).toBe(true);
    });
  });

  describe("rejects names with no letters or digits", () => {
    const symbolOnlyInputs = ["---", "###", "!!!", "@@@", "...", "____"];

    test.each(symbolOnlyInputs)("rejects: %s", (name) => {
      const { success, firstError } = parse(designationNameSchema, name);
      expect(success).toBe(false);
      expect(firstError).toMatch(/letter or number/i);
    });
  });

  describe("rejects wrong types", () => {
    test("rejects number", () => {
      expect(parse(designationNameSchema, 12345).success).toBe(false);
    });

    test("rejects null", () => {
      expect(parse(designationNameSchema, null).success).toBe(false);
    });

    test("rejects undefined", () => {
      expect(parse(designationNameSchema, undefined).success).toBe(false);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. designationBodySchema  (wraps name in an object)
// ═════════════════════════════════════════════════════════════════════════════

describe("designationBodySchema", () => {
  test("accepts a valid body", () => {
    const { success, data } = parse(designationBodySchema, { name: "Software Engineer" });
    expect(success).toBe(true);
    expect(data.name).toBe("Software Engineer");
  });

  test("trims and collapses whitespace in the body name", () => {
    const { data } = parse(designationBodySchema, { name: "  HR  Manager  " });
    expect(data.name).toBe("HR Manager");
  });

  test("rejects body with missing name", () => {
    const { success } = parse(designationBodySchema, {});
    expect(success).toBe(false);
  });

  test("rejects body with empty name", () => {
    const { success, firstError } = parse(designationBodySchema, { name: "" });
    expect(success).toBe(false);
    expect(firstError).toMatch(/required/i);
  });

  test("rejects body with name shorter than 2 chars", () => {
    const { success, firstError } = parse(designationBodySchema, { name: "A" });
    expect(success).toBe(false);
    expect(firstError).toMatch(/at least 2/i);
  });

  test("rejects body with name longer than 100 chars", () => {
    const { success, firstError } = parse(designationBodySchema, { name: "A".repeat(101) });
    expect(success).toBe(false);
    expect(firstError).toMatch(/100/);
  });

  test("rejects body with symbol-only name", () => {
    const { success, firstError } = parse(designationBodySchema, { name: "###" });
    expect(success).toBe(false);
    expect(firstError).toMatch(/letter or number/i);
  });

  test("preserves original casing", () => {
    const { data } = parse(designationBodySchema, { name: "SEnior Engineer" });
    expect(data.name).toBe("SEnior Engineer");
  });

  test("accepts name with letters, digits and symbols", () => {
    const { success } = parse(designationBodySchema, { name: "Lead-Eng & Dev (L3)" });
    expect(success).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. Edge cases
// ═════════════════════════════════════════════════════════════════════════════

describe("edge cases", () => {
  test("accepts 2-char name after trim", () => {
    expect(parse(designationBodySchema, { name: " AB " }).success).toBe(true);
  });

  test("rejects 1-char name after trim", () => {
    expect(parse(designationBodySchema, { name: " A " }).success).toBe(false);
  });

  test("accepts exactly 100 chars", () => {
    expect(parse(designationBodySchema, { name: "A".repeat(100) }).success).toBe(true);
  });

  test("rejects 101 chars", () => {
    expect(parse(designationBodySchema, { name: "A".repeat(101) }).success).toBe(false);
  });

  test("digits-only name is valid", () => {
    expect(parse(designationBodySchema, { name: "123" }).success).toBe(true);
  });

  test("tab and newline are treated as whitespace and collapsed", () => {
    const { data } = parse(designationBodySchema, { name: "HR\tManager" });
    expect(data.name).toBe("HR Manager");
  });
});
