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
const {
  createEmployee,
  getEmployeeByQrToken,
  updateEmployee,
} = require("../controllers/employee.controller");

const mockDuplicateRows = (rows) => {
  Employee.find.mockReturnValue({
    lean: jest.fn().mockResolvedValue(rows),
  });
};

const mockPopulateQuery = (value) => ({
  populate: jest.fn().mockReturnThis(),
  then(resolve) {
    return Promise.resolve(resolve(value));
  },
});

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

describe("employee.controller QR profile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns only safe QR profile fields", async () => {
    const response = createMockResponse();
    const employee = {
      employeeCode: "EMP-001",
      employeeName: "Asha",
      photo: "asha.png",
      designation: { name: "Supervisor" },
      department: [{ _id: "department-1", name: "Operations", subDepartments: [] }],
      subDepartment: ["internal-sub-dept"],
      sites: [{ _id: "site-1", name: "HQ", companyName: "Repplen", subSites: [] }],
      dateOfJoining: new Date("2026-05-01T00:00:00.000Z"),
      mobile: "9876543210",
      isActive: true,
      updatedAt: new Date("2026-05-11T10:00:00.000Z"),
      password: "secret",
      qrToken: "token",
      qrEnabled: true,
      toObject() {
        return { ...this };
      },
    };
    Employee.findOne.mockReturnValue(mockPopulateQuery(employee));

    await getEmployeeByQrToken(
      {
        params: { qrToken: "token" },
        protocol: "http",
        get: jest.fn(() => "localhost:5000"),
      },
      response
    );

    const payload = response.json.mock.calls[0][0];

    expect(payload).toEqual({
      employeeCode: "EMP-001",
      employeeName: "Asha",
      profilePhoto: "http://localhost:5000/uploads/asha.png",
      companyName: "Repplen",
      designation: "Supervisor",
      department: "Operations",
      dateOfJoining: employee.dateOfJoining,
      mobile: "9876543210",
      status: "Active",
      updatedAt: employee.updatedAt,
    });
    expect(payload).not.toHaveProperty("password");
    expect(payload).not.toHaveProperty("qrToken");
    expect(payload).not.toHaveProperty("subDepartment");
    expect(payload).not.toHaveProperty("site");
  });
});
