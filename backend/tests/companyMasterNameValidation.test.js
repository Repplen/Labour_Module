/**
 * companyMasterNameValidation.test.js
 *
 * Unit tests for validateCompanyName and normalizeMasterName
 * from backend/utils/masterNameValidation.js.
 * These are the pure-function business rules used by company.routes.js.
 */

const {
  normalizeMasterName,
  validateCompanyName,
  validateMasterName,
} = require("../utils/masterNameValidation");

// ─── normalizeMasterName ──────────────────────────────────────────────────────

describe("normalizeMasterName", () => {
  test("trims leading and trailing whitespace", () => {
    expect(normalizeMasterName("  Acme Corp  ")).toBe("Acme Corp");
  });

  test("collapses internal multiple spaces to one", () => {
    expect(normalizeMasterName("Acme   Corp")).toBe("Acme Corp");
  });

  test("returns empty string for empty input", () => {
    expect(normalizeMasterName("")).toBe("");
  });

  test("returns empty string for null", () => {
    expect(normalizeMasterName(null)).toBe("");
  });

  test("returns empty string for undefined", () => {
    expect(normalizeMasterName(undefined)).toBe("");
  });

  test("coerces number to string", () => {
    expect(normalizeMasterName(123)).toBe("123");
  });

  test("preserves single internal space", () => {
    expect(normalizeMasterName("Nova Tech")).toBe("Nova Tech");
  });
});

// ─── validateCompanyName ──────────────────────────────────────────────────────

describe("validateCompanyName — valid names", () => {
  const validCases = [
    ["Acme Corp",          "Acme Corp"],
    ["AB",                 "AB"],
    ["123 Industries",     "123 Industries"],
    ["A1-Corp & Co.",      "A1-Corp & Co."],
    ["  Nova Tech  ",      "Nova Tech"],   // trimmed
    ["A".repeat(100),      "A".repeat(100)],
  ];

  test.each(validCases)("accepts '%s' → normalized '%s'", (input, expected) => {
    const { name, error } = validateCompanyName(input);
    expect(error).toBe("");
    expect(name).toBe(expected);
  });
});

describe("validateCompanyName — required", () => {
  test("rejects empty string", () => {
    const { error } = validateCompanyName("");
    expect(error).toMatch(/required/i);
  });

  test("rejects whitespace-only string", () => {
    const { error } = validateCompanyName("   ");
    expect(error).toMatch(/required/i);
  });

  test("rejects null", () => {
    const { error } = validateCompanyName(null);
    expect(error).toMatch(/required/i);
  });

  test("rejects undefined", () => {
    const { error } = validateCompanyName(undefined);
    expect(error).toMatch(/required/i);
  });
});

describe("validateCompanyName — minimum length", () => {
  test("rejects a single character", () => {
    const { error } = validateCompanyName("A");
    expect(error).toMatch(/at least 2/i);
  });

  test("rejects a single character surrounded by spaces (trimmed = 1 char)", () => {
    const { error } = validateCompanyName("  A  ");
    expect(error).toMatch(/at least 2/i);
  });

  test("accepts exactly 2 characters", () => {
    const { error } = validateCompanyName("AB");
    expect(error).toBe("");
  });
});

describe("validateCompanyName — maximum length", () => {
  test("rejects a name longer than 100 characters", () => {
    const { error } = validateCompanyName("A".repeat(101));
    expect(error).toMatch(/100/);
  });

  test("accepts exactly 100 characters", () => {
    const { error } = validateCompanyName("A".repeat(100));
    expect(error).toBe("");
  });
});

describe("validateCompanyName — must contain a letter or number", () => {
  const symbolOnly = ["---", "###", "!!!", "@@@", "...", "$$$$", "____", "((("];

  test.each(symbolOnly)("rejects '%s' (only symbols)", (input) => {
    const { error } = validateCompanyName(input);
    expect(error).toMatch(/letter or number/i);
  });

  test("accepts digits-only (e.g. '123')", () => {
    const { error } = validateCompanyName("123");
    expect(error).toBe("");
  });
});

describe("validateCompanyName — return shape", () => {
  test("returns { name, error } with normalized name and empty error on success", () => {
    const result = validateCompanyName("  Acme Corp  ");
    expect(result).toMatchObject({ name: "Acme Corp", error: "" });
  });

  test("returns { name, error } with non-empty error on failure", () => {
    const result = validateCompanyName("");
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("error");
    expect(result.error).not.toBe("");
  });
});

// ─── validateMasterName (generic — Department, Designation, Site) ─────────────

describe("validateMasterName", () => {
  test("uses the supplied label in error messages", () => {
    const { error } = validateMasterName("", "Department");
    expect(error).toMatch(/department/i);
  });

  test("applies the same rules as validateCompanyName", () => {
    expect(validateMasterName("").error).toMatch(/required/i);
    expect(validateMasterName("A").error).toMatch(/at least 2/i);
    expect(validateMasterName("A".repeat(101)).error).toMatch(/100/);
    expect(validateMasterName("---").error).toMatch(/letter or number/i);
    expect(validateMasterName("Accounts Team").error).toBe("");
  });
});
