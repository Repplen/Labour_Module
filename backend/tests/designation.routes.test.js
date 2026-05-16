const express = require("express");
const request = require("supertest");

// ─── Middleware stubs ─────────────────────────────────────────────────────────

jest.mock("../middleware/auth", () => ({
  auth: (_req, _res, next) => next(),
}));

jest.mock("../middleware/permissions", () => ({
  requirePermission: () => (_req, _res, next) => next(),
}));

// validateRequest is NOT mocked — Zod validation runs in all route tests.

// ─── Model mocks ──────────────────────────────────────────────────────────────

jest.mock("../models/Designation", () => {
  const Designation = jest.fn();
  Designation.find   = jest.fn();
  Designation.exists = jest.fn();
  Designation.findOne = jest.fn();
  Designation.create = jest.fn();
  Designation.findOneAndUpdate = jest.fn();
  return Designation;
});

jest.mock("../models/Employee", () => {
  const Employee = jest.fn();
  Employee.exists = jest.fn();
  return Employee;
});

const Designation = require("../models/Designation");
const Employee    = require("../models/Employee");

const designationRoutes = require("../routes/designation.routes");
const { errorHandler, errorResponseNormalizer } = require("../middleware/errorHandler");

// ─── App factory ─────────────────────────────────────────────────────────────

const createApp = () => {
  const app = express();
  app.use(errorResponseNormalizer);
  app.use(express.json());
  app.use("/designations", designationRoutes);
  app.use(errorHandler);
  return app;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_ID  = "64f1a2b3c4d5e6f7a8b9c0d1";
const OTHER_ID  = "64f1a2b3c4d5e6f7a8b9c0d2";

const makeDesignation = (overrides = {}) => ({
  _id: VALID_ID,
  name: "Software Engineer",
  isActive: true,
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

// ═══════════════════════════════════════════════════════════════════════════════
// GET /designations
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /designations", () => {
  test("returns 200 with array of active designations", async () => {
    Designation.find.mockReturnValue({
      sort: jest.fn().mockResolvedValue([
        makeDesignation({ name: "HR Manager" }),
        makeDesignation({ _id: OTHER_ID, name: "Software Engineer" }),
      ]),
    });

    const res = await request(createApp()).get("/designations");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  test("returns 200 with empty array when no designations exist", async () => {
    Designation.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    const res = await request(createApp()).get("/designations");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  test("returns 500 on database error", async () => {
    Designation.find.mockReturnValue({
      sort: jest.fn().mockRejectedValue(new Error("DB error")),
    });
    const res = await request(createApp()).get("/designations");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /designations
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /designations", () => {
  test("creates a designation and returns 201", async () => {
    Designation.exists.mockResolvedValue(null);
    Designation.findOne.mockResolvedValue(null);
    Designation.create.mockResolvedValue(makeDesignation());

    const res = await request(createApp())
      .post("/designations")
      .send({ name: "Software Engineer" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Software Engineer");
  });

  test("normalizes whitespace before saving", async () => {
    Designation.exists.mockResolvedValue(null);
    Designation.findOne.mockResolvedValue(null);
    Designation.create.mockResolvedValue(makeDesignation({ name: "HR Manager" }));

    const res = await request(createApp())
      .post("/designations")
      .send({ name: "  HR  Manager  " });

    expect(res.status).toBe(201);
    expect(Designation.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "HR Manager" })
    );
  });

  test("rejects empty name with 400", async () => {
    const res = await request(createApp())
      .post("/designations")
      .send({ name: "" });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toMatch(/required/i);
  });

  test("rejects whitespace-only name with 400", async () => {
    const res = await request(createApp())
      .post("/designations")
      .send({ name: "   " });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toMatch(/required/i);
  });

  test("rejects name shorter than 2 chars with 400", async () => {
    const res = await request(createApp())
      .post("/designations")
      .send({ name: "A" });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toMatch(/at least 2/i);
  });

  test("rejects name longer than 100 chars with 400", async () => {
    const res = await request(createApp())
      .post("/designations")
      .send({ name: "A".repeat(101) });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toMatch(/100/);
  });

  test("rejects symbol-only name with 400", async () => {
    const res = await request(createApp())
      .post("/designations")
      .send({ name: "###" });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toMatch(/letter or number/i);
  });

  test("returns 409 for duplicate active designation name", async () => {
    Designation.exists.mockResolvedValue({ _id: VALID_ID });

    const res = await request(createApp())
      .post("/designations")
      .send({ name: "Software Engineer" });

    expect(res.status).toBe(409);
    expect(res.body.errors[0].message).toMatch(/already exists/i);
  });

  test("reactivates a soft-deleted designation instead of creating a new document", async () => {
    const softDeleted = makeDesignation({ isActive: false });
    Designation.exists.mockResolvedValue(null);
    Designation.findOne.mockResolvedValue(softDeleted);

    const res = await request(createApp())
      .post("/designations")
      .send({ name: "Software Engineer" });

    expect(res.status).toBe(201);
    expect(softDeleted.save).toHaveBeenCalled();
    expect(Designation.create).not.toHaveBeenCalled();
    expect(softDeleted.isActive).toBe(true);
  });

  test("creates a fresh document when no soft-deleted record exists", async () => {
    Designation.exists.mockResolvedValue(null);
    Designation.findOne.mockResolvedValue(null);
    Designation.create.mockResolvedValue(makeDesignation());

    await request(createApp())
      .post("/designations")
      .send({ name: "Software Engineer" });

    expect(Designation.create).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /designations/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe("PUT /designations/:id", () => {
  test("updates designation name and returns 200", async () => {
    Designation.exists.mockResolvedValue(null);
    Designation.findOneAndUpdate.mockResolvedValue(
      makeDesignation({ name: "Senior Engineer" })
    );

    const res = await request(createApp())
      .put(`/designations/${VALID_ID}`)
      .send({ name: "Senior Engineer" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Senior Engineer");
  });

  test("returns 404 when designation does not exist", async () => {
    Designation.exists.mockResolvedValue(null);
    Designation.findOneAndUpdate.mockResolvedValue(null);

    const res = await request(createApp())
      .put(`/designations/${VALID_ID}`)
      .send({ name: "Senior Engineer" });

    expect(res.status).toBe(404);
  });

  test("returns 409 when updated name duplicates another designation", async () => {
    Designation.exists.mockResolvedValue({ _id: OTHER_ID });

    const res = await request(createApp())
      .put(`/designations/${VALID_ID}`)
      .send({ name: "HR Manager" });

    expect(res.status).toBe(409);
    expect(res.body.errors[0].message).toMatch(/already exists/i);
  });

  test("rejects invalid name on update with 400", async () => {
    const res = await request(createApp())
      .put(`/designations/${VALID_ID}`)
      .send({ name: "A" });

    expect(res.status).toBe(400);
    expect(res.body.errors[0].message).toMatch(/at least 2/i);
  });

  test("returns 400 for invalid ObjectId in params", async () => {
    const res = await request(createApp())
      .put("/designations/not-a-valid-id")
      .send({ name: "Engineer" });

    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /designations/:id
// ═══════════════════════════════════════════════════════════════════════════════

describe("DELETE /designations/:id", () => {
  test("soft-deletes a designation and returns 200 with isActive: false", async () => {
    const designation = makeDesignation();
    Designation.findOne.mockResolvedValue(designation);
    Employee.exists.mockResolvedValue(null);

    const res = await request(createApp())
      .delete(`/designations/${VALID_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
    expect(designation.save).toHaveBeenCalled();
    expect(designation.isActive).toBe(false);
  });

  test("returns 404 when designation does not exist", async () => {
    Designation.findOne.mockResolvedValue(null);

    const res = await request(createApp())
      .delete(`/designations/${VALID_ID}`);

    expect(res.status).toBe(404);
  });

  test("blocks deletion when designation is assigned to an employee and returns 400", async () => {
    Designation.findOne.mockResolvedValue(makeDesignation());
    Employee.exists.mockResolvedValue({ _id: "emp-id" });

    const res = await request(createApp())
      .delete(`/designations/${VALID_ID}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/employee/i);
  });

  test("does NOT modify the record when deletion is blocked by an employee", async () => {
    const designation = makeDesignation();
    Designation.findOne.mockResolvedValue(designation);
    Employee.exists.mockResolvedValue({ _id: "emp-id" });

    await request(createApp())
      .delete(`/designations/${VALID_ID}`);

    expect(designation.save).not.toHaveBeenCalled();
  });

  test("returns 400 for invalid ObjectId in params", async () => {
    const res = await request(createApp())
      .delete("/designations/not-a-valid-id");

    expect(res.status).toBe(400);
  });
});
