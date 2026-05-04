const express = require("express");
const request = require("supertest");

const mockGetChecklistSetupData = jest.fn((_req, res) =>
  res.status(200).json({ route: "setup-data" })
);

jest.mock("../middleware/auth", () => ({
  auth: (_req, _res, next) => next(),
}));

jest.mock("../middleware/permissions", () => ({
  requireAnyPermission: () => (_req, _res, next) => next(),
  requirePermission: () => (_req, _res, next) => next(),
}));

jest.mock("../middleware/validateRequest", () => ({
  validateRequest: () => (_req, _res, next) => next(),
}));

jest.mock("../middleware/checklistUpload", () => ({
  array: () => (_req, _res, next) => next(),
}));

jest.mock("../middleware/excelUpload", () => ({
  single: () => (_req, _res, next) => next(),
}));

jest.mock("../controllers/checklist.controller", () =>
  new Proxy(
    {},
    {
      get: (_target, property) => {
        if (property === "getChecklistSetupData") {
          return mockGetChecklistSetupData;
        }

        return (_req, res) => res.status(200).json({ route: String(property) });
      },
    }
  )
);

const checklistRoutes = require("../routes/checklist.routes");

const createTestApp = () => {
  const app = express();
  app.use("/", checklistRoutes);
  return app;
};

describe("checklist routes", () => {
  beforeEach(() => {
    mockGetChecklistSetupData.mockClear();
  });

  test("routes setup data before checklist id validation", async () => {
    await request(createTestApp()).get("/setup-data").expect(200, { route: "setup-data" });

    expect(mockGetChecklistSetupData).toHaveBeenCalledTimes(1);
  });
});
