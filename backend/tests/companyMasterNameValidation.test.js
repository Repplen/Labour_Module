const {
  normalizeMasterName,
  validateCompanyName,
  validateMasterName,
} = require("../utils/masterNameValidation");

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
});

describe("validateCompanyName - valid names", () => {
  const validCases = [
    ["Acme Corp", "Acme Corp"],
    ["AB", "AB"],
    ["123 Industries", "123 Industries"],
    ["A1-Corp & Co.", "A1-Corp & Co."],
    ["A.K. Traders", "A.K. Traders"],
    ["M&S Associates", "M&S Associates"],
    ["Tech-Solutions", "Tech-Solutions"],
    ["Internal_System", "Internal_System"],
    ["Logistics/Exports", "Logistics/Exports"],
    ["Company (Branch)", "Company (Branch)"],
    ["  Nova Tech  ", "Nova Tech"],
    ["A".repeat(100), "A".repeat(100)],
  ];

  test.each(validCases)("accepts '%s' as '%s'", (input, expected) => {
    const { name, error } = validateCompanyName(input);

    expect(error).toBe("");
    expect(name).toBe(expected);
  });
});

describe("validateCompanyName - required", () => {
  test.each(["", "   ", null, undefined])("rejects %p", (input) => {
    const { error } = validateCompanyName(input);

    expect(error).toMatch(/required/i);
  });
});

describe("validateCompanyName - length", () => {
  test("rejects a single character", () => {
    const { error } = validateCompanyName("A");
    expect(error).toMatch(/at least 2/i);
  });

  test("accepts exactly 2 characters", () => {
    const { error } = validateCompanyName("AB");
    expect(error).toBe("");
  });

  test("rejects a name longer than 100 characters", () => {
    const { error } = validateCompanyName("A".repeat(101));
    expect(error).toMatch(/100/);
  });

  test("accepts exactly 100 characters", () => {
    const { error } = validateCompanyName("A".repeat(100));
    expect(error).toBe("");
  });
});

describe("validateCompanyName - alphabet requirement", () => {
  test.each(["---", "###", "!!!", "@@@", "...", "$$$$", "____", "(((", "123", "34"])(
    "rejects '%s'",
    (input) => {
      const { error } = validateCompanyName(input);

      expect(error).toMatch(/alphabet/i);
    }
  );
});

describe("validateCompanyName - start character", () => {
  test.each(["-Acme Corp", ".Acme Corp", "& Acme Corp", "(Acme Corp"])(
    "rejects '%s'",
    (input) => {
      const { error } = validateCompanyName(input);

      expect(error).toMatch(/start with a letter or number/i);
    }
  );
});

describe("validateCompanyName - invalid characters", () => {
  test.each([
    "ABC, Pvt Ltd",
    "John's Company",
    "Company #1",
    "R&D @ Chennai",
    "Acme * Corp",
    "Acme + Corp",
    "Acme: Corp",
    "Acme [North]",
  ])("rejects '%s'", (input) => {
    const { error } = validateCompanyName(input);

    expect(error).toMatch(/invalid characters/i);
  });
});

describe("validateCompanyName - repeated separators", () => {
  test.each([
    "Tech--Solutions",
    "A..K Traders",
    "M&&S Associates",
    "Internal__System",
    "Logistics//Exports",
  ])("rejects '%s'", (input) => {
    const { error } = validateCompanyName(input);

    expect(error).toMatch(/repeated separators/i);
  });
});

describe("validateCompanyName - return shape", () => {
  test("returns normalized name and empty error on success", () => {
    const result = validateCompanyName("  Acme Corp  ");

    expect(result).toMatchObject({ name: "Acme Corp", error: "" });
  });

  test("returns name and non-empty error on failure", () => {
    const result = validateCompanyName("");

    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("error");
    expect(result.error).not.toBe("");
  });
});

describe("validateMasterName", () => {
  test("uses the supplied label in error messages", () => {
    const { error } = validateMasterName("", "Department");

    expect(error).toMatch(/department/i);
  });

  test("keeps generic master-name rules unchanged", () => {
    expect(validateMasterName("").error).toMatch(/required/i);
    expect(validateMasterName("A").error).toMatch(/at least 2/i);
    expect(validateMasterName("A".repeat(101)).error).toMatch(/100/);
    expect(validateMasterName("---").error).toMatch(/letter or number/i);
    expect(validateMasterName("123").error).toBe("");
    expect(validateMasterName("Accounts Team").error).toBe("");
  });
});
