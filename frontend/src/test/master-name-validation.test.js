import { describe, expect, test } from "vitest";
import { validateCompanyName, validateMasterName } from "../utils/masterNameValidation";

describe("master name validation", () => {
  test("company name allows only letters and spaces", () => {
    expect(validateCompanyName("Nova Tech")).toBe("");
    expect(validateCompanyName("kmnjnj7686778")).toBe(
      "Company name can contain only letters and spaces."
    );
    expect(validateCompanyName("(((( ^^^^")).toBe(
      "Company name can contain only letters and spaces."
    );
  });

  test("department, designation, and site names allow only letters and spaces", () => {
    expect(validateMasterName("Accounts Team", "Department")).toBe("");
    expect(validateMasterName("Accounts123", "Department")).toBe(
      "Department name can contain only letters and spaces."
    );
    expect(validateMasterName("Lead-Admin", "Designation")).toBe(
      "Designation name can contain only letters and spaces."
    );
    expect(validateMasterName("Main Site", "Site")).toBe("");
    expect(validateMasterName("Site 01", "Site")).toBe(
      "Site name can contain only letters and spaces."
    );
  });
});
