jest.mock("../models/Employee", () => {
  const Employee = jest.fn();
  Employee.find = jest.fn();
  Employee.findById = jest.fn();
  Employee.findByIdAndUpdate = jest.fn();
  Employee.findOne = jest.fn();
  Employee.exists = jest.fn();
  return Employee;
});

jest.mock("../models/Department", () => ({
  find: jest.fn(),
}));

jest.mock("../models/Site", () => ({
  find: jest.fn(),
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
}));

jest.mock("../services/accessScope.service", () => ({
  buildEmployeeScopeFilter: jest.fn(),
  isAllScope: jest.fn(() => true),
  resolveAccessibleEmployeeIds: jest.fn(),
}));

const Employee = require("../models/Employee");
const { createMockResponse } = require("./helpers/http");
const { createEmployee, updateEmployee } = require("../controllers/employee.controller");

const mockDuplicateRows = (rows) => {
  Employee.find.mockReturnValue({
    lean: jest.fn().mockResolvedValue(rows),
  });
};

describe("employee.controller duplicate contact validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("rejects create when email and mobile already exist", async () => {
    mockDuplicateRows([
      {
        email: "admin@test.com",
        mobile: "9876543210",
      },
    ]);

    const response = createMockResponse();

    await createEmployee(
      {
        body: {
          employeeCode: "EMP-2",
          employeeName: "Second Employee",
          email: "Admin@Test.com",
          mobile: "98765 43210",
          password: "secret123",
        },
      },
      response
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      message: "Duplicate employee data found",
      errors: [
        {
          field: "email",
          message: "This email ID already exists.",
        },
        {
          field: "mobile",
          message: "This mobile number already exists.",
        },
      ],
    });
    expect(Employee).not.toHaveBeenCalled();
  });

  test("rejects update when another employee owns the same contact data", async () => {
    mockDuplicateRows([
      {
        email: "admin@test.com",
        mobile: "9876543210",
      },
    ]);

    const response = createMockResponse();

    await updateEmployee(
      {
        params: { id: "current-employee-id" },
        body: {
          email: "ADMIN@test.com",
          mobile: "98765 43210",
        },
      },
      response
    );

    expect(Employee.find).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $ne: "current-employee-id" },
      }),
      "email mobile"
    );
    expect(response.status).toHaveBeenCalledWith(409);
    expect(Employee.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
