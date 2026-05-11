jest.mock("../models/Company", () => ({
  find: jest.fn(),
}));

jest.mock("../models/Department", () => ({
  find: jest.fn(),
}));

jest.mock("../models/Employee", () => ({
  find: jest.fn(),
  findById: jest.fn(),
}));

jest.mock("../models/Site", () => ({
  find: jest.fn(),
}));

const Company = require("../models/Company");
const Department = require("../models/Department");
const Employee = require("../models/Employee");
const Site = require("../models/Site");
const { resolveAccessibleEmployeeIds } = require("../services/accessScope.service");

const leanResult = (value) => ({
  lean: jest.fn().mockResolvedValue(value),
});

const mockLeadershipLookups = ({
  employee = {
    _id: "head-1",
    employeeCode: "5010",
    employeeName: "Paramashivam",
    email: "paramashivam@test.com",
  },
  companies = [],
  departments = [],
  sites = [],
} = {}) => {
  Employee.findById.mockReturnValue(leanResult(employee));
  Company.find.mockReturnValue(leanResult(companies));
  Department.find.mockReturnValue(leanResult(departments));
  Site.find.mockReturnValue(leanResult(sites));
};

describe("access scope employee leadership", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("keeps own-scope employees limited to themselves when they are not a head", async () => {
    mockLeadershipLookups();

    const employeeIds = await resolveAccessibleEmployeeIds({
      principalType: "employee",
      principalId: "head-1",
      scope: {
        strategy: "own",
        departmentIds: ["dept-1"],
        siteIds: ["site-1"],
      },
    });

    expect(employeeIds).toEqual(["head-1"]);
    expect(Employee.find).not.toHaveBeenCalled();
  });

  test("includes employees from a department headed by the current employee", async () => {
    mockLeadershipLookups({
      departments: [
        {
          _id: "dept-1",
          headNames: ["5010 - Paramashivam"],
          departmentLeadNames: [],
          subDepartments: [],
        },
      ],
    });
    Employee.find.mockReturnValue(
      leanResult([{ _id: "head-1" }, { _id: "employee-5038" }])
    );

    const employeeIds = await resolveAccessibleEmployeeIds({
      principalType: "employee",
      principalId: "head-1",
      scope: {
        strategy: "own",
        departmentIds: ["dept-own"],
        siteIds: ["site-own"],
      },
    });

    expect(employeeIds).toEqual(["head-1", "employee-5038"]);
    expect(Employee.find).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: { $ne: false },
        $or: expect.arrayContaining([
          { _id: { $in: ["head-1"] } },
          { department: { $in: ["dept-1"] } },
        ]),
      }),
      "_id"
    );
  });

  test("includes employees from a site led by the current employee", async () => {
    mockLeadershipLookups({
      sites: [
        {
          _id: "site-1",
          companyName: "Repplen Project Pvt Ltd",
          headNames: [],
          siteLeadNames: ["5010 - Paramashivam"],
          subSites: [],
        },
      ],
    });
    Employee.find.mockReturnValue(
      leanResult([{ _id: "head-1" }, { _id: "employee-5038" }])
    );

    const employeeIds = await resolveAccessibleEmployeeIds({
      principalType: "employee",
      principalId: "head-1",
      scope: {
        strategy: "own",
      },
    });

    expect(employeeIds).toEqual(["head-1", "employee-5038"]);
    expect(Employee.find).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: { $ne: false },
        $or: expect.arrayContaining([
          { _id: { $in: ["head-1"] } },
          { sites: { $in: ["site-1"] } },
        ]),
      }),
      "_id"
    );
  });
});
