import { describe, expect, test } from "vitest";
import { validateCompanyName, validateMasterName, normalizeMasterName } from "../utils/masterNameValidation";

// These utils mirror frontend-side validation before sending data to the backend.
// Backend validation remains the source of truth.

describe("masterNameValidation utils", () => {
  describe("validateCompanyName", () => {
    test("returns empty string for valid company names", () => {
      expect(validateCompanyName("Nova Tech")).toBe("");
      expect(validateCompanyName("kmnjnj7686778")).toBe("");
      expect(validateCompanyName("A.K. Traders")).toBe("");
      expect(validateCompanyName("M&S Associates")).toBe("");
      expect(validateCompanyName("Tech-Solutions")).toBe("");
      expect(validateCompanyName("Internal_System")).toBe("");
      expect(validateCompanyName("Logistics/Exports")).toBe("");
      expect(validateCompanyName("Company (Branch)")).toBe("");
    });

    test("returns an error for invalid company names", () => {
      expect(validateCompanyName("")).toMatch(/required/i);
      expect(validateCompanyName("34")).toMatch(/alphabet/i);
      expect(validateCompanyName("(((( ^^^^")).toMatch(/alphabet/i);
      expect(validateCompanyName("-Acme Corp")).toMatch(/start with a letter or number/i);
      expect(validateCompanyName("Acme * Corp")).toMatch(/invalid characters/i);
      expect(validateCompanyName("Tech--Solutions")).toMatch(/repeated separators/i);
    });
  });

  describe("validateMasterName", () => {
    test("returns empty string for valid master names", () => {
      expect(validateMasterName("Accounts Team", "Department")).toBe("");
      expect(validateMasterName("Accounts123", "Department")).toBe("");
      expect(validateMasterName("Lead-Admin", "Designation")).toBe("");
      expect(validateMasterName("Main Site", "Site")).toBe("");
      expect(validateMasterName("Site 01", "Site")).toBe("");
    });

    test("returns an error for invalid master names", () => {
      expect(validateMasterName("", "Department")).toMatch(/required/i);
      expect(validateMasterName("###", "Department")).toMatch(/letter or number/i);
    });
  });

  describe("normalizeMasterName", () => {
    test("trims leading and trailing whitespace", () => {
      expect(normalizeMasterName("  Nova Tech  ")).toBe("Nova Tech");
    });

    test("collapses multiple internal spaces to one", () => {
      expect(normalizeMasterName("Nova  Tech")).toBe("Nova Tech");
    });

    test("returns the string unchanged when already clean", () => {
      expect(normalizeMasterName("Accounts")).toBe("Accounts");
    });

    test("returns empty string for empty input", () => {
      expect(normalizeMasterName("")).toBe("");
    });
  });
});
