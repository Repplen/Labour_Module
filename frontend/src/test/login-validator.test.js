import { describe, expect, test } from "vitest";
import { loginSchema, validateLoginForm } from "../validators/login.validator";

// ── loginSchema (Zod) ────────────────────────────────────────

describe("loginSchema", () => {
  describe("loginId", () => {
    test("accepts a plain string login ID", () => {
      const result = loginSchema.safeParse({ loginId: "john", password: "secret123" });
      expect(result.success).toBe(true);
    });

    test("accepts an email as login ID", () => {
      const result = loginSchema.safeParse({ loginId: "john@example.com", password: "secret123" });
      expect(result.success).toBe(true);
    });

    test("accepts an employee code as login ID", () => {
      const result = loginSchema.safeParse({ loginId: "EMP001", password: "secret123" });
      expect(result.success).toBe(true);
    });

    test("rejects empty loginId", () => {
      const result = loginSchema.safeParse({ loginId: "", password: "secret123" });
      expect(result.success).toBe(false);
      const msg = result.error.issues.find((i) => i.path[0] === "loginId")?.message;
      expect(msg).toBe("Login ID is required");
    });

    test("rejects whitespace-only loginId", () => {
      const result = loginSchema.safeParse({ loginId: "   ", password: "secret123" });
      expect(result.success).toBe(false);
      const msg = result.error.issues.find((i) => i.path[0] === "loginId")?.message;
      expect(msg).toBe("Login ID is required");
    });

    test("rejects missing loginId field", () => {
      const result = loginSchema.safeParse({ password: "secret123" });
      expect(result.success).toBe(false);
    });
  });

  describe("password", () => {
    test("accepts a valid password", () => {
      const result = loginSchema.safeParse({ loginId: "john", password: "secret123" });
      expect(result.success).toBe(true);
    });

    test("rejects empty password", () => {
      const result = loginSchema.safeParse({ loginId: "john", password: "" });
      expect(result.success).toBe(false);
      const msg = result.error.issues.find((i) => i.path[0] === "password")?.message;
      expect(msg).toBe("Password is required");
    });

    test("rejects password shorter than 6 characters", () => {
      const result = loginSchema.safeParse({ loginId: "john", password: "abc" });
      expect(result.success).toBe(false);
      const msg = result.error.issues.find((i) => i.path[0] === "password")?.message;
      expect(msg).toBe("Password must be at least 6 characters");
    });

    test("accepts password with exactly 6 characters", () => {
      const result = loginSchema.safeParse({ loginId: "john", password: "abc123" });
      expect(result.success).toBe(true);
    });

    test("rejects missing password field", () => {
      const result = loginSchema.safeParse({ loginId: "john" });
      expect(result.success).toBe(false);
    });
  });
});

// ── validateLoginForm ────────────────────────────────────────

describe("validateLoginForm", () => {
  test("returns valid:true for correct data", () => {
    const { valid, errors } = validateLoginForm({ loginId: "john", password: "secret123" });
    expect(valid).toBe(true);
    expect(errors).toEqual({});
  });

  test("returns loginId error when loginId is empty", () => {
    const { valid, errors } = validateLoginForm({ loginId: "", password: "secret123" });
    expect(valid).toBe(false);
    expect(errors.loginId).toBe("Login ID is required");
  });

  test("returns password error when password is empty", () => {
    const { valid, errors } = validateLoginForm({ loginId: "john", password: "" });
    expect(valid).toBe(false);
    expect(errors.password).toBe("Password is required");
  });

  test("returns password error when password is too short", () => {
    const { valid, errors } = validateLoginForm({ loginId: "john", password: "abc" });
    expect(valid).toBe(false);
    expect(errors.password).toBe("Password must be at least 6 characters");
  });

  test("returns both errors when both fields are empty", () => {
    const { valid, errors } = validateLoginForm({ loginId: "", password: "" });
    expect(valid).toBe(false);
    expect(errors.loginId).toBeTruthy();
    expect(errors.password).toBeTruthy();
  });

  test("trims whitespace from loginId before validating", () => {
    const { valid, errors } = validateLoginForm({ loginId: "   ", password: "secret123" });
    expect(valid).toBe(false);
    expect(errors.loginId).toBe("Login ID is required");
  });
});
