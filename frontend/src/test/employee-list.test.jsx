import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import EmployeeList from "../pages/EmployeeList";
import api from "../api/axios";

vi.mock("../api/axios", () => ({
  default: {
    defaults: { baseURL: "/api" },
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../context/usePermissions", () => ({
  usePermissions: () => ({
    can: () => true,
  }),
}));

describe("employee list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("toggles and applies employee table-heading filters together", async () => {
    api.get.mockResolvedValue({
      data: [
        {
          _id: "employee-1",
          employeeCode: "5035",
          employeeName: "Karthick",
          email: "karthick@test.com",
          mobile: "9876543210",
          departmentDetails: [{ _id: "department-1", name: "Admin" }],
          subDepartmentDetails: [{ _id: "sub-1", path: "Admin > Store" }],
          superiorEmployeeName: "5012 - Devaraju",
          sites: [{ _id: "site-1", companyName: "JRS", name: "Head Office" }],
          subSiteDetails: [{ subSitePath: "JRS - Head Office > A0" }],
          designation: { name: "Officer" },
          isActive: true,
        },
        {
          _id: "employee-2",
          employeeCode: "6539",
          employeeName: "Bharathi",
          email: "bharathi@test.com",
          mobile: "9123456780",
          departmentDetails: [{ _id: "department-2", name: "Soft" }],
          subDepartmentDetails: [{ _id: "sub-2", path: "Soft > Todo" }],
          superiorEmployeeName: "5012 - Devaraju",
          sites: [{ _id: "site-2", companyName: "Repplen", name: "Head Office" }],
          subSiteDetails: [{ subSitePath: "Repplen - Head Office > A0" }],
          designation: { name: "Senior" },
          isActive: true,
        },
      ],
    });

    render(
      <MemoryRouter>
        <EmployeeList />
      </MemoryRouter>
    );

    expect(await screen.findByText("Karthick")).toBeInTheDocument();
    expect(screen.getByText("Bharathi")).toBeInTheDocument();
    expect(screen.queryByLabelText(/table filter by department/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^filter$/i }));

    expect(screen.getByRole("button", { name: /hide filters/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/table filter by department/i), {
      target: { value: "Admin" },
    });
    fireEvent.change(screen.getByLabelText(/table filter by site/i), {
      target: { value: "JRS - Head Office" },
    });
    fireEvent.change(screen.getByLabelText(/table filter by status/i), {
      target: { value: "active" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^apply$/i }));

    expect(screen.getByText("Karthick")).toBeInTheDocument();
    expect(screen.queryByText("Bharathi")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^clear filters$/i }));

    expect(screen.getByText("Bharathi")).toBeInTheDocument();
  });
});
