import { describe, expect, test } from "vitest";
import {
  employeeValidationMessages,
  validateEmployeeFields,
} from "../utils/employeeFieldValidation";

describe("employee field validation", () => {
  test("rejects noisy employee code, name, and email before duplicate validation", () => {
    expect(
      validateEmployeeFields({
        employeeCode: "6050DD3fdshb",
        employeeName: "$Karthick#&^&^*",
        mobile: "6381414992",
        email: "karth&*90997$^%&*i@gmail.com",
      })
    ).toEqual({
      employeeCode: employeeValidationMessages.employeeCodeInvalid,
      employeeName: employeeValidationMessages.employeeNameInvalid,
      email: employeeValidationMessages.emailInvalid,
    });
  });

  test("allows numeric employee code, name, mobile, and email formats", () => {
    expect(
      validateEmployeeFields({
        employeeCode: "8015",
        employeeName: "Ajay D",
        mobile: "9876543210",
        email: "admin@test.com",
      })
    ).toEqual({});
  });
});
