/**
 * companyRoutes.test.js
 *
 * Integration tests for company.routes.js using supertest + mocked models.
 * No real database — all Mongoose calls are replaced with Jest mocks.
 */

const express = require("express");
const request = require("supertest");

// ─── Middleware stubs ─────────────────────────────────────────────────────────

jest.mock("../middleware/auth", () => ({
  auth: (_req, _res, next) => next(),
}));

jest.mock("../middleware/permissions", () => ({
  requirePermission: () => (_req, _res, next) => next(),
}));

jest.mock("../services/accessScope.service", () => ({
  buildCompanyScopeFilter: jest.fn().mockResolvedValue({}),
}));

// ─── Model mocks ──────────────────────────────────────────────────────────────

jest.mock("../models/Company", () => {
  const Company = jest.fn();
  Company.find    = jest.fn();
  Company.exists  = jest.fn();
  Company.findOne = jest.fn();
  Company.create  = jest.fn();
  return Company;
});

jest.mock("../models/Employee", () => {
  const Employee = jest.fn();
  Employee.find = jest.fn();
  return Employee;
});

jest.mock("../models/Site", () => ({
  exists:     jest.fn(),
  updateMany: jest.fn(),
}));

const Company  = require("../models/Company");
const Employee = require("../models/Employee");
const Site     = require("../models/Site");

const companyRoutes = require("../routes/company.routes");

// ─── App factory ─────────────────────────────────────────────────────────────

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/companies", companyRoutes);
  return app;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeCompany = (overrides = {}) => ({
  _id: "64f1a2b3c4d5e6f7a8b9c0d1",
  name: "Acme Corp",
  directorNames: [],
  isActive: true,
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

const makeEmployee = (overrides = {}) => ({
  _id: "64f1a2b3c4d5e6f7a8b9c0d2",
  employeeCode: "EMP-001",
  employeeName: "John Doe",
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => jest.clearAllMocks());

// ═══════════════════════════════════════════════════════════════════════════════
// GET /companies
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /companies", () => {
  test("returns 200 with array of companies", async () => {
    Company.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([
        makeCompany({ name: "Acme Corp" }),
        makeCompany({ _id: "id2", name: "Tech Co" }),
      ]),
    });

    const res = await request(createApp()).get("/companies");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  test("returns 200 with empty array when no companies exist", async () => {
    Company.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    const res = await request(createApp()).get("/companies");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  test("returns 500 on database error", async () => {
    Company.find.mockReturnValue({
      sort: jest.fn().mockRejectedValue(new Error("DB error")),
    });
    const res = await request(createApp()).get("/companies");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /companies
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /companies", () => {
  test("creates a company and returns 201", async () => {
    Company.exists.mockResolvedValue(null);
    Company.create.mockResolvedValue(makeCompany());

    const res = await request(createApp())
      .post("/companies")
      .send({ name: "Acme Corp" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Acme Corp");
  });

  test("trims whitespace from the saved name", async () => {
    Company.exists.mockResolvedValue(null);
    Company.create.mockResolvedValue(makeCompany({ name: "Nova Tech" }));

    const res = await request(createApp())
      .post("/companies")
      .send({ name: "  Nova Tech  " });

    expect(res.status).toBe(201);
    expect(Company.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Nova Tech" })
    );
  });

  test("rejects empty name with 400", async () => {
    const res = await request(createApp())
      .post("/companies")
      .send({ name: "" });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toMatch(/required/i);
  });

  test("rejects whitespace-only name with 400", async () => {
    const res = await request(createApp())
      .post("/companies")
      .send({ name: "   " });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toMatch(/required/i);
  });

  test("rejects name shorter than 2 chars with 400", async () => {
    const res = await request(createApp())
      .post("/companies")
      .send({ name: "A" });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toMatch(/at least 2/i);
  });

  test("rejects name longer than 100 chars with 400", async () => {
    const res = await request(createApp())
      .post("/companies")
      .send({ name: "A".repeat(101) });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toMatch(/100/);
  });

  test("rejects symbol-only name with 400", async () => {
    const res = await request(createApp())
      .post("/companies")
      .send({ name: "###" });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toMatch(/alphabet/i);
  });

  test("returns 409 for duplicate company name", async () => {
    Company.exists.mockResolvedValue({ _id: "existing-id" });

    const res = await request(createApp())
      .post("/companies")
      .send({ name: "Acme Corp" });

    expect(res.status).toBe(409);
    expect(res.body.errors[0].message).toMatch(/already exists/i);
  });

  test("resolves directorEmployeeIds to formatted director names", async () => {
    const emp = makeEmployee();
    Employee.find.mockResolvedValue([emp]);
    Company.exists.mockResolvedValue(null);
    Company.create.mockResolvedValue(
      makeCompany({ directorNames: ["EMP-001 - John Doe"] })
    );

    const res = await request(createApp())
      .post("/companies")
      .send({ name: "Acme Corp", directorEmployeeIds: [String(emp._id)] });

    expect(res.status).toBe(201);
    expect(Company.create).toHaveBeenCalledWith(
      expect.objectContaining({ directorNames: ["EMP-001 - John Doe"] })
    );
  });

  test("returns 400 when a directorEmployeeId does not match any active employee", async () => {
    Employee.find.mockResolvedValue([]); // none found

    const res = await request(createApp())
      .post("/companies")
      .send({
        name: "Acme Corp",
        directorEmployeeIds: ["64f1a2b3c4d5e6f7a8b9c0d9"],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /companies/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe("PUT /companies/:id", () => {
  test("updates company name and returns 200", async () => {
    const company = makeCompany({ name: "Old Name" });
    Company.findOne.mockResolvedValue(company);
    Company.exists.mockResolvedValue(null);
    Site.updateMany.mockResolvedValue({});

    const res = await request(createApp())
      .put("/companies/64f1a2b3c4d5e6f7a8b9c0d1")
      .send({ name: "New Name" });

    expect(res.status).toBe(200);
  });

  test("returns 404 for non-existent company", async () => {
    Company.findOne.mockResolvedValue(null);

    const res = await request(createApp())
      .put("/companies/nonexistent")
      .send({ name: "New Name" });

    expect(res.status).toBe(404);
  });

  test("returns 409 when updated name duplicates another company", async () => {
    Company.findOne.mockResolvedValue(makeCompany({ name: "Old Name" }));
    Company.exists.mockResolvedValue({ _id: "other-id" });

    const res = await request(createApp())
      .put("/companies/64f1a2b3c4d5e6f7a8b9c0d1")
      .send({ name: "Acme Corp" });

    expect(res.status).toBe(409);
  });

  test("cascades name change to Site records", async () => {
    Company.findOne.mockResolvedValue(makeCompany({ name: "Old Name" }));
    Company.exists.mockResolvedValue(null);
    Site.updateMany.mockResolvedValue({});

    await request(createApp())
      .put("/companies/64f1a2b3c4d5e6f7a8b9c0d1")
      .send({ name: "New Name" });

    expect(Site.updateMany).toHaveBeenCalledWith(
      { companyName: "Old Name" },
      { $set: { companyName: "New Name" } }
    );
  });

  test("does NOT cascade when name is unchanged", async () => {
    Company.findOne.mockResolvedValue(makeCompany({ name: "Acme Corp" }));
    Company.exists.mockResolvedValue(null);
    Site.updateMany.mockResolvedValue({});

    await request(createApp())
      .put("/companies/64f1a2b3c4d5e6f7a8b9c0d1")
      .send({ name: "Acme Corp" });

    expect(Site.updateMany).not.toHaveBeenCalled();
  });

  test("rejects invalid name on update with 400", async () => {
    const res = await request(createApp())
      .put("/companies/64f1a2b3c4d5e6f7a8b9c0d1")
      .send({ name: "A" });

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /companies/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe("DELETE /companies/:id", () => {
  test("soft-deletes a company and returns 200 with isActive: false", async () => {
    const company = makeCompany();
    Company.findOne.mockResolvedValue(company);
    Site.exists.mockResolvedValue(null);

    const res = await request(createApp())
      .delete("/companies/64f1a2b3c4d5e6f7a8b9c0d1");

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
    expect(company.save).toHaveBeenCalled();
  });

  test("returns 404 for non-existent company", async () => {
    Company.findOne.mockResolvedValue(null);

    const res = await request(createApp())
      .delete("/companies/nonexistent");

    expect(res.status).toBe(404);
  });

  test("blocks deletion when company is in use by a Site and returns 400", async () => {
    Company.findOne.mockResolvedValue(makeCompany());
    Site.exists.mockResolvedValue({ _id: "site-id" });

    const res = await request(createApp())
      .delete("/companies/64f1a2b3c4d5e6f7a8b9c0d1");

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/site master/i);
  });

  test("does NOT modify the record when deletion is blocked", async () => {
    const company = makeCompany();
    Company.findOne.mockResolvedValue(company);
    Site.exists.mockResolvedValue({ _id: "site-id" });

    await request(createApp())
      .delete("/companies/64f1a2b3c4d5e6f7a8b9c0d1");

    expect(company.save).not.toHaveBeenCalled();
  });
});
