import { describe, expect, test } from "vitest";

const allowedCompanyNameRegex = /^[A-Za-z0-9 .&()/_-]+$/;
const repeatedCompanySeparatorRegex = /([.&()/_-])\1/;

const computeLiveNameError = (name, companies = [], editingId = "") => {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "";
  if (trimmed.length < 2) return "Company name must be at least 2 characters.";
  if (trimmed.length > 100) return "Company name must not exceed 100 characters.";
  if (!/[a-zA-Z]/.test(trimmed))
    return "Company name must contain at least one alphabet.";
  if (!/^[A-Za-z0-9]/.test(trimmed))
    return "Company name must start with a letter or number.";
  if (!allowedCompanyNameRegex.test(trimmed))
    return "Company name contains invalid characters.";
  if (repeatedCompanySeparatorRegex.test(trimmed))
    return "Company name must not contain repeated separators.";

  const isDuplicate = companies.some(
    (company) =>
      String(company._id) !== String(editingId) &&
      company.name.trim().toLowerCase() === trimmed.toLowerCase()
  );

  return isDuplicate ? "This company name already exists." : "";
};

describe("liveNameError - empty input", () => {
  test("returns no error for empty string before required display is enabled", () => {
    expect(computeLiveNameError("")).toBe("");
  });
});

describe("liveNameError - length", () => {
  test("returns error for 1 character", () => {
    expect(computeLiveNameError("A")).toMatch(/at least 2/i);
  });

  test("accepts exactly 2 characters", () => {
    expect(computeLiveNameError("AB")).toBe("");
  });

  test("rejects names longer than 100 characters", () => {
    expect(computeLiveNameError("A".repeat(101))).toMatch(/100/);
  });
});

describe("liveNameError - company-name standard", () => {
  test.each([
    "Acme Corp",
    "123 Industries",
    "A1-Corp & Co.",
    "A.K. Traders",
    "M&S Associates",
    "Tech-Solutions",
    "Internal_System",
    "Logistics/Exports",
    "Company (Branch)",
  ])("accepts '%s'", (input) => {
    expect(computeLiveNameError(input)).toBe("");
  });

  test.each(["---", "###", "!!!", "@@@", "...", "$$$$", "____", "123", "34"])(
    "requires an alphabet for '%s'",
    (input) => {
      expect(computeLiveNameError(input)).toMatch(/alphabet/i);
    }
  );

  test.each(["-Acme Corp", ".Acme Corp", "& Acme Corp", "(Acme Corp"])(
    "rejects starting separator in '%s'",
    (input) => {
      expect(computeLiveNameError(input)).toMatch(/start with a letter or number/i);
    }
  );

  test.each([
    "ABC, Pvt Ltd",
    "John's Company",
    "Company #1",
    "R&D @ Chennai",
    "Acme * Corp",
    "Acme + Corp",
    "Acme: Corp",
    "Acme [North]",
  ])("rejects invalid characters in '%s'", (input) => {
    expect(computeLiveNameError(input)).toMatch(/invalid characters/i);
  });

  test.each([
    "Tech--Solutions",
    "A..K Traders",
    "M&&S Associates",
    "Internal__System",
    "Logistics//Exports",
  ])("rejects repeated separators in '%s'", (input) => {
    expect(computeLiveNameError(input)).toMatch(/repeated separators/i);
  });
});

describe("liveNameError - duplicate detection", () => {
  const existingCompanies = [
    { _id: "id1", name: "Acme Corp" },
    { _id: "id2", name: "Nova Tech" },
  ];

  test("returns error when name matches an existing company case-insensitively", () => {
    expect(computeLiveNameError("acme corp", existingCompanies)).toMatch(
      /already exists/i
    );
  });

  test("does not flag duplicate when editing the same company", () => {
    expect(computeLiveNameError("Acme Corp", existingCompanies, "id1")).toBe("");
  });
});

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
});

const buildDirectorSelectionState = (savedDirectorNames = [], employeeRows = []) => {
  const normalizedSaved = Array.isArray(savedDirectorNames)
    ? savedDirectorNames.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  const byLookup = new Map();
  employeeRows.forEach((employee) => {
    const employeeId = String(employee._id || "");
    const label = getEmployeeDirectorLabel(employee);
    [label, employee.employeeName, employee.employeeCode]
      .map((item) => String(item || "").trim().toLowerCase())
      .filter(Boolean)
      .forEach((item) => {
        if (!byLookup.has(item)) byLookup.set(item, employeeId);
      });
  });

  const selectedEmployeeIds = [];
  const legacyDirectorNames = [];
  const seenIds = new Set();

  normalizedSaved.forEach((item) => {
    const matchId = byLookup.get(item.toLowerCase());
    if (!matchId) {
      legacyDirectorNames.push(item);
      return;
    }

    if (!seenIds.has(matchId)) {
      seenIds.add(matchId);
      selectedEmployeeIds.push(matchId);
    }
  });

  return { selectedEmployeeIds, legacyDirectorNames };
};

describe("buildDirectorSelectionState", () => {
  test("maps saved director labels to employee IDs", () => {
    const employees = [
      { _id: "emp1", employeeCode: "EMP-001", employeeName: "John Doe" },
    ];

    const result = buildDirectorSelectionState(["EMP-001 - John Doe"], employees);

    expect(result.selectedEmployeeIds).toEqual(["emp1"]);
  });
});

const getBackendError = (err) => {
  const data = err?.response?.data;
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  if (errors.length > 0) return errors[0]?.message || "";
  if (data?.message) return data.message;
  return "Something went wrong. Please try again.";
};

describe("getBackendError", () => {
  test("extracts first error message from errors array", () => {
    const err = {
      response: { data: { errors: [{ message: "Company name is required." }] } },
    };

    expect(getBackendError(err)).toBe("Company name is required.");
  });
});
