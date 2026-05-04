jest.mock("../config/env", () => ({
  env: {
    jwtSecret: "test-secret",
    jwtExpiresIn: "1h",
  },
}));

jest.mock("../models/User", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock("../models/Employee", () => ({
  findOne: jest.fn(),
}));

jest.mock("../models/Role", () => ({
  findOne: jest.fn(),
}));

jest.mock("../models/Site", () => ({
  findOne: jest.fn(),
}));

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
}));

jest.mock("../services/permissionResolver.service", () => ({
  buildSessionUserPayload: jest.fn(),
  resolvePrincipalAccess: jest.fn(),
}));

const User = require("../models/User");
const Employee = require("../models/Employee");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  buildSessionUserPayload,
  resolvePrincipalAccess,
} = require("../services/permissionResolver.service");
const { createMockResponse } = require("./helpers/http");
const { getUsers, login } = require("../controllers/auth.controller");

describe("auth.controller login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("logs in an active checklist master user", async () => {
    const userDoc = {
      _id: "user-1",
      name: "Operations Manager",
      role: "user",
      email: "manager@example.com",
      password: "hashed-password",
      checklistMasterAccess: true,
      site: {
        _id: "site-1",
        name: "Head Office",
        companyName: "Repplen",
      },
      isDefaultAdmin: false,
    };

    User.findOne.mockReturnValue({
      populate: jest.fn().mockResolvedValue(userDoc),
    });
    Employee.findOne.mockReturnValue({
      select: jest.fn(),
    });
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue("signed-token");
    resolvePrincipalAccess.mockResolvedValue({ permissions: {} });
    buildSessionUserPayload.mockReturnValue({
      id: "user-1",
      name: "Operations Manager",
      principalType: "user",
      homePath: "/dashboard",
    });

    const request = {
      body: {
        loginId: "manager@example.com",
        password: "secret123",
      },
    };
    const response = createMockResponse();

    await login(request, response);

    expect(User.findOne).toHaveBeenCalledWith({
      email: "manager@example.com",
      isActive: { $ne: false },
    });
    expect(bcrypt.compare).toHaveBeenCalledWith("secret123", "hashed-password");
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-1",
        role: "user",
        principalType: "user",
      }),
      "test-secret",
      { expiresIn: "1h" }
    );
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "signed-token",
        user: expect.objectContaining({
          id: "user-1",
          name: "Operations Manager",
          principalType: "user",
        }),
      })
    );
  });

  test("rejects empty credentials before checking the database", async () => {
    const response = createMockResponse();

    await login(
      {
        body: {
          loginId: "",
          password: "",
        },
      },
      response
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Login ID and password are required",
      })
    );
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test("lists only active admin panel users", async () => {
    const rows = [
      {
        _id: "active-user-1",
        name: "Active User",
        email: "active@example.com",
        isActive: true,
      },
    ];
    const sort = jest.fn().mockResolvedValue(rows);
    const populateRole = jest.fn().mockReturnValue({ sort });
    const populateSite = jest.fn().mockReturnValue({ populate: populateRole });

    User.find.mockReturnValue({ populate: populateSite });

    const response = createMockResponse();

    await getUsers({}, response);

    expect(User.find).toHaveBeenCalledWith(
      { isActive: { $ne: false } },
      expect.stringContaining("name email role")
    );
    expect(populateSite).toHaveBeenCalledWith("site", "name companyName");
    expect(populateRole).toHaveBeenCalledWith(
      "roleId",
      "key name dashboardType scopeStrategy homeModuleKey"
    );
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(response.json).toHaveBeenCalledWith(rows);
  });
});
