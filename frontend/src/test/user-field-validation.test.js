import { describe, expect, test } from "vitest";
import { userValidationMessages, validateUserFields } from "../utils/userFieldValidation";

describe("user field validation", () => {
  test("allows only letters and spaces for checklist master user name", () => {
    expect(
      validateUserFields({
        name: "kmnjnj7686778",
        email: "admin@gmail.com",
        password: "secret123",
      })
    ).toEqual({
      name: userValidationMessages.nameInvalid,
    });

    expect(
      validateUserFields({
        name: "Checklist Master",
        email: "admin@gmail.com",
        password: "secret123",
      })
    ).toEqual({});
  });

  test("rejects invalid checklist master user email format", () => {
    expect(
      validateUserFields({
        name: "Checklist Master",
        email: "1001@!#ghygmail.com",
        password: "secret123",
      })
    ).toEqual({
      email: userValidationMessages.emailInvalid,
    });
  });
});
