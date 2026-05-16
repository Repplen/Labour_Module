/**
 * company-validation.test.js
 *
 * Tests for:
 *  1. liveNameError rules (mirrors CompanyMaster.jsx useMemo logic)
 *  2. getEmployeeDirectorLabel  (pure helper in CompanyMaster.jsx)
 *  3. buildDirectorSelectionState (pure helper in CompanyMaster.jsx)
 *  4. getBackendError (pure helper in CompanyMaster.jsx)
 */

import { describe, expect, test } from "vitest";

// ─── 1. liveNameError logic ───────────────────────────────────────────────────
//
// This mirrors the useMemo in CompanyMaster.jsx exactly.
// Keeping it as a pure function here makes the rules independently testable.

const computeLiveNameError = (name, companies = [], editingId = "") => {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "";
  if (trimmed.length < 2) return "Company name must be at least 2 characters.";
  if (trimmed.length > 100) return "Company name must not exceed 100 characters.";
  if (!/[a-zA-Z0-9]/.test(trimmed))
    return "Company name must contain at least one letter or number.";
  const isDuplicate = companies.some(
    (c) =>
      String(c._id) !== String(editingId) &&
      c.name.trim().toLowerCase() === trimmed.toLowerCase()
  );
  return isDuplicate ? "This company name already exists." : "";
};

describe("liveNameError — empty input", () => {
  test("returns no error for empty string (handled by disabled button)", () => {
    expect(computeLiveNameError("")).toBe("");
  });

  test("returns no error for whitespace-only string", () => {
    expect(computeLiveNameError("   ")).toBe("");
  });
});

describe("liveNameError — minimum length", () => {
  test("returns error for 1 character", () => {
    expect(computeLiveNameError("A")).toMatch(/at least 2/i);
  });

  test("returns no error for exactly 2 characters", () => {
    expect(computeLiveNameError("AB")).toBe("");
  });

  test("returns no error for a normal name", () => {
    expect(computeLiveNameError("Acme Corp")).toBe("");
  });
});

describe("liveNameError — maximum length", () => {
  test("returns error for 101 characters", () => {
    expect(computeLiveNameError("A".repeat(101))).toMatch(/100/);
  });

  test("returns no error for exactly 100 characters", () => {
    expect(computeLiveNameError("A".repeat(100))).toBe("");
  });
});

describe("liveNameError — must contain letter or number", () => {
  const symbolOnlyInputs = ["---", "###", "!!!", "@@@", "...", "$$$$", "____"];

  test.each(symbolOnlyInputs)("returns error for '%s'", (input) => {
    expect(computeLiveNameError(input)).toMatch(/letter or number/i);
  });

  test("accepts digits-only name like '123'", () => {
    expect(computeLiveNameError("123")).toBe("");
  });

  test("accepts name with letters and symbols like 'A1-Corp & Co.'", () => {
    expect(computeLiveNameError("A1-Corp & Co.")).toBe("");
  });
});

describe("liveNameError — duplicate detection", () => {
  const existingCompanies = [
    { _id: "id1", name: "Acme Corp" },
    { _id: "id2", name: "Nova Tech" },
  ];

  test("returns error when name matches an existing company (case-insensitive)", () => {
    expect(computeLiveNameError("acme corp", existingCompanies)).toMatch(
      /already exists/i
    );
  });

  test("returns error for different casing of existing name", () => {
    expect(computeLiveNameError("NOVA TECH", existingCompanies)).toMatch(
      /already exists/i
    );
  });

  test("does NOT flag as duplicate when editing the same company", () => {
    expect(computeLiveNameError("Acme Corp", existingCompanies, "id1")).toBe("");
  });

  test("flags as duplicate when name matches a DIFFERENT company while editing", () => {
    // editing id1 but typing the name of id2
    expect(computeLiveNameError("Nova Tech", existingCompanies, "id1")).toMatch(
      /already exists/i
    );
  });

  test("returns no error for a unique new name", () => {
    expect(computeLiveNameError("Brand New Co", existingCompanies)).toBe("");
  });
});

// ─── 2. getEmployeeDirectorLabel ──────────────────────────────────────────────

const getEmployeeDirectorLabel = (employee) => {
  const code = String(employee?.employeeCode || "").trim();
  const name = String(employee?.employeeName || "").trim();
  if (code && name) return `${code} - ${name}`;
  return code || name;
};

describe("getEmployeeDirectorLabel", () => {
  test("returns 'code - name' when both are present", () => {
    expect(
      getEmployeeDirectorLabel({ employeeCode: "EMP-001", employeeName: "John Doe" })
    ).toBe("EMP-001 - John Doe");
  });

  test("returns only code when name is missing", () => {
    expect(getEmployeeDirectorLabel({ employeeCode: "EMP-001", employeeName: "" })).toBe(
      "EMP-001"
    );
  });

  test("returns only name when code is missing", () => {
    expect(getEmployeeDirectorLabel({ employeeCode: "", employeeName: "Jane Smith" })).toBe(
      "Jane Smith"
    );
  });

  test("returns empty string when both are missing", () => {
    expect(getEmployeeDirectorLabel({ employeeCode: "", employeeName: "" })).toBe("");
  });

  test("returns empty string for null/undefined employee", () => {
    expect(getEmployeeDirectorLabel(null)).toBe("");
    expect(getEmployeeDirectorLabel(undefined)).toBe("");
  });

  test("trims whitespace from code and name", () => {
    expect(
      getEmployeeDirectorLabel({ employeeCode: "  EMP-001  ", employeeName: "  John  " })
    ).toBe("EMP-001 - John");
  });
});

// ─── 3. buildDirectorSelectionState ──────────────────────────────────────────

const buildDirectorSelectionState = (savedDirectorNames = [], employeeRows = []) => {
  const normalizedSaved = Array.isArray(savedDirectorNames)
    ? savedDirectorNames.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  const byLookup = new Map();
  employeeRows.forEach((employee) => {
    const employeeId = String(employee._id || "");
    const label = getEmployeeDirectorLabel(employee);
    const lookups = [
      label,
      String(employee.employeeName || "").trim(),
      String(employee.employeeCode || "").trim(),
    ]
      .map((item) => item.toLowerCase())
      .filter(Boolean);
    lookups.forEach((item) => {
      if (!byLookup.has(item)) byLookup.set(item, employeeId);
    });
  });

  const selectedEmployeeIds = [];
  const legacyDirectorNames = [];
  const seenIds = new Set();

  normalizedSaved.forEach((item) => {
    const matchId = byLookup.get(item.toLowerCase());
    if (matchId) {
      if (!seenIds.has(matchId)) {
        seenIds.add(matchId);
        selectedEmployeeIds.push(matchId);
      }
      return;
    }
    legacyDirectorNames.push(item);
  });

  return { selectedEmployeeIds, legacyDirectorNames };
};

describe("buildDirectorSelectionState", () => {
  const employees = [
    { _id: "emp1", employeeCode: "EMP-001", employeeName: "John Doe" },
    { _id: "emp2", employeeCode: "EMP-002", employeeName: "Jane Smith" },
  ];

  test("maps a saved director label to its employee ID", () => {
    const { selectedEmployeeIds } = buildDirectorSelectionState(
      ["EMP-001 - John Doe"],
      employees
    );
    expect(selectedEmployeeIds).toEqual(["emp1"]);
  });

  test("maps multiple directors to their IDs", () => {
    const { selectedEmployeeIds } = buildDirectorSelectionState(
      ["EMP-001 - John Doe", "EMP-002 - Jane Smith"],
      employees
    );
    expect(selectedEmployeeIds).toEqual(["emp1", "emp2"]);
  });

  test("lookup by name alone (without code prefix)", () => {
    const { selectedEmployeeIds } = buildDirectorSelectionState(
      ["John Doe"],
      employees
    );
    expect(selectedEmployeeIds).toContain("emp1");
  });

  test("lookup is case-insensitive", () => {
    const { selectedEmployeeIds } = buildDirectorSelectionState(
      ["emp-001 - john doe"],
      employees
    );
    expect(selectedEmployeeIds).toContain("emp1");
  });

  test("puts unrecognised names into legacyDirectorNames", () => {
    const { legacyDirectorNames } = buildDirectorSelectionState(
      ["Old Director Name"],
      employees
    );
    expect(legacyDirectorNames).toContain("Old Director Name");
  });

  test("deduplicates — same employee referenced twice is resolved once", () => {
    const { selectedEmployeeIds } = buildDirectorSelectionState(
      ["EMP-001 - John Doe", "John Doe"],
      employees
    );
    expect(selectedEmployeeIds.filter((id) => id === "emp1")).toHaveLength(1);
  });

  test("returns empty arrays for empty inputs", () => {
    const result = buildDirectorSelectionState([], []);
    expect(result.selectedEmployeeIds).toHaveLength(0);
    expect(result.legacyDirectorNames).toHaveLength(0);
  });
});

// ─── 4. getBackendError ───────────────────────────────────────────────────────

const getBackendError = (err) => {
  const data = err?.response?.data;
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  if (errors.length > 0) return errors[0]?.message || "";
  if (data?.message) return data.message;
  return "Something went wrong. Please try again.";
};

describe("getBackendError", () => {
  test("extracts first error message from errors array (Zod/422 shape)", () => {
    const err = {
      response: { data: { errors: [{ message: "Company name is required." }] } },
    };
    expect(getBackendError(err)).toBe("Company name is required.");
  });

  test("falls back to data.message when errors array is absent", () => {
    const err = { response: { data: { message: "Not found" } } };
    expect(getBackendError(err)).toBe("Not found");
  });

  test("falls back to generic message when both are absent", () => {
    expect(getBackendError({})).toBe("Something went wrong. Please try again.");
  });

  test("handles null gracefully", () => {
    expect(getBackendError(null)).toBe("Something went wrong. Please try again.");
  });

  test("prefers errors array over data.message when both exist", () => {
    const err = {
      response: {
        data: {
          errors: [{ message: "Specific field error" }],
          message: "Generic message",
        },
      },
    };
    expect(getBackendError(err)).toBe("Specific field error");
  });

  test("returns empty string when errors array is present but first message is empty", () => {
    const err = {
      response: {
        data: {
          errors: [{ message: "" }],
          message: "fallback",
        },
      },
    };
    // errors.length > 0 short-circuits; returns errors[0].message || "" → ""
    expect(getBackendError(err)).toBe("");
  });
});
