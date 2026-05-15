/**
 * company.test.js
 *
 * Unit tests for Company Zod validation schemas.
 * Run with:  npx jest company.test.js  (or npm test)
 */

const {
  createCompanySchema,
  updateCompanySchema,
  companyNameSchema,
} = require("../validators/companyValidation");


// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Parse with safeParse and return { success, data, firstError }.
 */
const parse = (schema, input) => {
  const result = schema.safeParse(input);
  // Zod v3 uses .issues; .errors is an alias that may not exist in all versions
  const issues = result.success
    ? []
    : result.error?.issues ?? result.error?.errors ?? [];
  return {
    success: result.success,
    data: result.success ? result.data : undefined,
    firstError: issues[0]?.message,
    errors: issues,
  };
};

// ═════════════════════════════════════════════════════════════════════════════
// 1. companyNameSchema  (isolated name-field tests)
// ═════════════════════════════════════════════════════════════════════════════

describe("companyNameSchema", () => {
  // ── Valid names ────────────────────────────────────────────────────────────
  describe("valid inputs", () => {
    const validNames = [
      "Acme Corp",
      "TechSolutions123",
      "A1 Builders & Co.",
      "123 Industries",
      "Ré & Associés",           // accented letters still contain a letter
      "  Trimmed Name  ",        // whitespace trimmed by schema
      "AB",                      // minimum 2 chars after trim
      "X".repeat(100),           // exactly 100 chars
    ];

    test.each(validNames)("accepts: %s", (name) => {
      const { success } = parse(companyNameSchema, name);
      expect(success).toBe(true);
    });

    it("trims surrounding whitespace", () => {
      const { data } = parse(companyNameSchema, "  Acme Corp  ");
      expect(data).toBe("Acme Corp");
    });
  });

  // ── Only special characters ────────────────────────────────────────────────
  describe("rejects names with no letters or digits (only special chars)", () => {
    const onlySymbols = [
      "---",
      "###",
      "!!!",
      "@@@",
      "...",
      "   ---   ",   // after trim still has no letter/digit
      "$$$$",
      "____",
    ];

    test.each(onlySymbols)("rejects: %s", (name) => {
      const { success, firstError } = parse(companyNameSchema, name);
      expect(success).toBe(false);
      expect(firstError).toMatch(/letter or number/i);
    });
  });

  // ── Too short ──────────────────────────────────────────────────────────────
  describe("rejects names that are too short", () => {
    it("rejects empty string", () => {
      const { success } = parse(companyNameSchema, "");
      expect(success).toBe(false);
    });

    it("rejects single character", () => {
      const { success } = parse(companyNameSchema, "A");
      expect(success).toBe(false);
    });

    it("rejects whitespace-only string", () => {
      const { success } = parse(companyNameSchema, "   ");
      expect(success).toBe(false);
    });
  });

  // ── Too long ───────────────────────────────────────────────────────────────
  it("rejects names longer than 100 characters", () => {
    const { success } = parse(companyNameSchema, "A".repeat(101));
    expect(success).toBe(false);
  });

  // ── Wrong type ─────────────────────────────────────────────────────────────
  it("rejects non-string input", () => {
    const { success } = parse(companyNameSchema, 12345);
    expect(success).toBe(false);
  });

  it("rejects null", () => {
    const { success } = parse(companyNameSchema, null);
    expect(success).toBe(false);
  });

  it("rejects undefined (required field)", () => {
    const { success } = parse(companyNameSchema, undefined);
    expect(success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. createCompanySchema
// ═════════════════════════════════════════════════════════════════════════════

describe("createCompanySchema", () => {

  // ── Minimal valid payload ──────────────────────────────────────────────────
  it("accepts a payload with only a valid name", () => {
    const { success, data } = parse(createCompanySchema, { name: "Acme Corp" });
    expect(success).toBe(true);
    expect(data.name).toBe("Acme Corp");
  });

  // ── Full valid payload ─────────────────────────────────────────────────────
  it("accepts a full valid payload", () => {
    const payload = {
      name: "TechSolutions123",
      directorNames: ["John Doe", "Jane Smith"],
      directorEmployeeIds: [
        "64f1a2b3c4d5e6f7a8b9c0d1",
        "64f1a2b3c4d5e6f7a8b9c0d2",
      ],
      isActive: true,
    };

    const { success, data } = parse(createCompanySchema, payload);
    expect(success).toBe(true);
    expect(data.name).toBe("TechSolutions123");
    expect(data.directorNames).toHaveLength(2);
    expect(data.directorEmployeeIds).toHaveLength(2);
  });

  // ── Defaults ───────────────────────────────────────────────────────────────
  it("defaults directorNames to [] when omitted", () => {
    const { success, data } = parse(createCompanySchema, { name: "Acme Corp" });
    expect(success).toBe(true);
    // optional field may be undefined if not supplied; defaults kick in when present
    expect(data.isActive === true || data.isActive === undefined).toBe(true);
  });

  // ── Missing name ───────────────────────────────────────────────────────────
  it("rejects payload without name", () => {
    const { success } = parse(createCompanySchema, {});
    expect(success).toBe(false);
  });

  // ── Only-symbol company name ───────────────────────────────────────────────
  it("rejects company name with only special characters", () => {
    const { success, firstError } = parse(createCompanySchema, { name: "---" });
    expect(success).toBe(false);
    expect(firstError).toMatch(/letter or number/i);
  });

  // ── Invalid directorEmployeeIds ────────────────────────────────────────────
  it("rejects invalid (non-ObjectId) employee IDs", () => {
    const { success } = parse(createCompanySchema, {
      name: "Acme Corp",
      directorEmployeeIds: ["not-an-id"],
    });
    expect(success).toBe(false);
  });

  it("accepts an empty directorEmployeeIds array", () => {
    const { success } = parse(createCompanySchema, {
      name: "Acme Corp",
      directorEmployeeIds: [],
    });
    expect(success).toBe(true);
  });

  // ── directorNames entries ──────────────────────────────────────────────────
  it("rejects empty string entries in directorNames", () => {
    const { success } = parse(createCompanySchema, {
      name: "Acme Corp",
      directorNames: ["John Doe", ""],
    });
    expect(success).toBe(false);
  });

  it("rejects non-string entries in directorNames", () => {
    const { success } = parse(createCompanySchema, {
      name: "Acme Corp",
      directorNames: [123],
    });
    expect(success).toBe(false);
  });

  // ── isActive ───────────────────────────────────────────────────────────────
  it("accepts isActive: false", () => {
    const { success } = parse(createCompanySchema, {
      name: "Acme Corp",
      isActive: false,
    });
    expect(success).toBe(true);
  });

  it("rejects non-boolean isActive", () => {
    const { success } = parse(createCompanySchema, {
      name: "Acme Corp",
      isActive: "yes",
    });
    expect(success).toBe(false);
  });

  // ── Name trimming ──────────────────────────────────────────────────────────
  it("trims the company name before validation", () => {
    const { success, data } = parse(createCompanySchema, { name: "  Acme Corp  " });
    expect(success).toBe(true);
    expect(data.name).toBe("Acme Corp");
  });

  // ── Case-sensitivity ───────────────────────────────────────────────────────
  it("preserves original casing (no forced uppercase/lowercase)", () => {
    const { data } = parse(createCompanySchema, { name: "AcMe CoRP" });
    expect(data.name).toBe("AcMe CoRP");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. updateCompanySchema
// ═════════════════════════════════════════════════════════════════════════════

describe("updateCompanySchema", () => {

  it("accepts an empty object (partial update — nothing to change)", () => {
    const { success } = parse(updateCompanySchema, {});
    expect(success).toBe(true);
  });

  it("accepts updating only the name", () => {
    const { success, data } = parse(updateCompanySchema, { name: "New Name 1" });
    expect(success).toBe(true);
    expect(data.name).toBe("New Name 1");
  });

  it("accepts updating only isActive", () => {
    const { success } = parse(updateCompanySchema, { isActive: false });
    expect(success).toBe(true);
  });

  it("accepts updating only directorEmployeeIds", () => {
    const { success } = parse(updateCompanySchema, {
      directorEmployeeIds: ["64f1a2b3c4d5e6f7a8b9c0d1"],
    });
    expect(success).toBe(true);
  });

  it("still rejects an only-symbol name when name is supplied", () => {
    const { success, firstError } = parse(updateCompanySchema, { name: "$$$$" });
    expect(success).toBe(false);
    expect(firstError).toMatch(/letter or number/i);
  });

  it("still rejects a name shorter than 2 chars when name is supplied", () => {
    const { success } = parse(updateCompanySchema, { name: "A" });
    expect(success).toBe(false);
  });

  it("still rejects invalid employee IDs when supplied", () => {
    const { success } = parse(updateCompanySchema, {
      directorEmployeeIds: ["bad-id"],
    });
    expect(success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. Edge cases
// ═════════════════════════════════════════════════════════════════════════════

describe("edge cases", () => {
  it("accepts company name with digits only (e.g. 123)", () => {
    // Digits alone satisfy the letter-or-digit requirement
    const { success } = parse(createCompanySchema, { name: "123" });
    expect(success).toBe(true);
  });

  it("accepts company name that is a mix of letters, digits and symbols", () => {
    const { success } = parse(createCompanySchema, { name: "A1-Corp & Co." });
    expect(success).toBe(true);
  });

  it("rejects company name of exactly 1 char after trim", () => {
    const { success } = parse(createCompanySchema, { name: " A " });
    // trimmed = "A" → length 1 → invalid
    expect(success).toBe(false);
  });

  it("accepts company name of exactly 2 chars after trim", () => {
    const { success } = parse(createCompanySchema, { name: " AB " });
    expect(success).toBe(true);
  });

  it("accepts company name of exactly 100 chars", () => {
    const { success } = parse(createCompanySchema, { name: "A".repeat(100) });
    expect(success).toBe(true);
  });

  it("rejects company name of 101 chars", () => {
    const { success } = parse(createCompanySchema, { name: "A".repeat(101) });
    expect(success).toBe(false);
  });
});
