import { describe, expect, test } from "vitest";
import {
  employeeDuplicateMessages,
  getApiDuplicateEmployeeErrors,
  getEmployeeDuplicateErrors,
} from "../utils/employeeDuplicateValidation";

describe("employee duplicate validation", () => {
  const employees = [
    {
      _id: "employee-1",
      employeeCode: "EMP-001",
      email: "admin@test.com",
      mobile: "9876543210",
    },
  ];

  test("detects trimmed code, case-insensitive email, and formatted mobile duplicates", () => {
    expect(
      getEmployeeDuplicateErrors(employees, {
        employeeCode: " EMP-001 ",
        email: "Admin@Test.com",
        mobile: "98765-43210",
      })
    ).toEqual({
      employeeCode: employeeDuplicateMessages.employeeCode,
      email: employeeDuplicateMessages.email,
      mobile: employeeDuplicateMessages.mobile,
    });
  });

  test("ignores the current employee when editing", () => {
    expect(
      getEmployeeDuplicateErrors(
        employees,
        {
          employeeCode: " EMP-001 ",
          email: "Admin@Test.com",
          mobile: "98765-43210",
        },
        "employee-1"
      )
    ).toEqual({});
  });

  test("maps backend field-wise duplicate errors to inline messages", () => {
    expect(
      getApiDuplicateEmployeeErrors({
        response: {
          data: {
            errors: [
              {
                field: "employeeCode",
                message: "This employee code already exists.",
              },
              { field: "email", message: "This email ID already exists." },
              { field: "mobile", message: "This mobile number already exists." },
            ],
          },
        },
      })
    ).toEqual({
      employeeCode: employeeDuplicateMessages.employeeCode,
      email: employeeDuplicateMessages.email,
      mobile: employeeDuplicateMessages.mobile,
    });
  });
});
