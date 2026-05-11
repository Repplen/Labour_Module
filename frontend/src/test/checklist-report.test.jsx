import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ChecklistReport from "../pages/reports/ChecklistReport";
import api from "../api/axios";

vi.mock("../api/axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock("../context/usePermissions", () => ({
  usePermissions: () => ({
    can: () => true,
    canAny: () => true,
    scope: { strategy: "own" },
  }),
}));

describe("checklist report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("unlocks employee filter when own-scope employee has head-level report access", async () => {
    api.get.mockImplementation((url) => {
      if (url === "/checklists/tasks/report/options") {
        return Promise.resolve({
          data: {
            scopeStrategy: "own",
            currentPrincipalEmployeeId: "head-1",
            employees: [
              {
                _id: "head-1",
                employeeCode: "5010",
                employeeName: "Paramashivam",
                departmentDisplay: "Admin",
              },
              {
                _id: "employee-5038",
                employeeCode: "5038",
                employeeName: "Aravinth",
                departmentDisplay: "Admin",
              },
            ],
            departments: [],
            sites: [],
          },
        });
      }

      return Promise.resolve({ data: [] });
    });

    render(
      <MemoryRouter>
        <ChecklistReport />
      </MemoryRouter>
    );

    expect(await screen.findByRole("option", { name: "All Employees" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /5038 - Aravinth/ })).toBeInTheDocument();
  });
});
