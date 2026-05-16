import { describe, expect, test } from "vitest";
import { validateCompanyName, validateMasterName, normalizeMasterName } from "../utils/masterNameValidation";

// These utils are intentional stubs — real validation rules live in:
//  - CompanyMaster.jsx      → liveNameError (useMemo)
//  - backend/utils/masterNameValidation.js → validateCompanyName / validateMasterName
// See frontend/src/test/company-validation.test.js for the full rule coverage.

describe("masterNameValidation utils (frontend stubs)", () => {
  describe("validateCompanyName stub", () => {
    test("returns empty string for any input (stub — no frontend util validation)", () => {
      expect(validateCompanyName("Nova Tech")).toBe("");
      expect(validateCompanyName("kmnjnj7686778")).toBe("");
      expect(validateCompanyName("(((( ^^^^")).toBe("");
      expect(validateCompanyName("")).toBe("");
    });
  });

  describe("validateMasterName stub", () => {
    test("returns empty string for any input (stub — no frontend util validation)", () => {
      expect(validateMasterName("Accounts Team", "Department")).toBe("");
      expect(validateMasterName("Accounts123", "Department")).toBe("");
      expect(validateMasterName("Lead-Admin", "Designation")).toBe("");
      expect(validateMasterName("Main Site", "Site")).toBe("");
      expect(validateMasterName("Site 01", "Site")).toBe("");
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
