import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ChecklistList from "../pages/checklists/ChecklistList";
import api from "../api/axios";

vi.mock("../api/axios", () => ({
  default: {
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

describe("checklist list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders checklist rows for checklist masters", async () => {
    api.get.mockResolvedValue({
      data: [
        {
          _id: "checklist-1",
          checklistNumber: "CHK-001",
          checklistName: "Daily Safety Walk",
          checklistSourceSite: { name: "HQ" },
          assignedToEmployee: {
            employeeCode: "EMP-001",
            employeeName: "Asha",
          },
          priority: "high",
          scheduleType: "daily",
          scheduleTime: "09:00",
          startDate: "2026-04-25T00:00:00.000Z",
          endDate: null,
          endTime: "",
          nextOccurrenceAt: null,
          status: true,
          approvals: [],
          isDependentTask: false,
        },
      ],
    });

    render(
      <MemoryRouter>
        <ChecklistList />
      </MemoryRouter>
    );

    expect(await screen.findByText("Daily Safety Walk")).toBeInTheDocument();
    expect(screen.getByText("CHK-001")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /deactivate checklist master chk-001/i })
    ).toBeInTheDocument();
  });

  test("applies checklist master table heading filters together", async () => {
    api.get.mockResolvedValue({
      data: [
        {
          _id: "checklist-1",
          checklistNumber: "CHK-001",
          checklistName: "Daily Safety Walk",
          checklistSourceSite: { name: "HQ" },
          assignedToEmployee: {
            employeeCode: "EMP-001",
            employeeName: "Karthick",
          },
          priority: "medium",
          scheduleType: "daily",
          scheduleTime: "09:00",
          startDate: "2026-04-25T00:00:00.000Z",
          endDate: null,
          endTime: "",
          nextOccurrenceAt: null,
          status: true,
          approvalHierarchy: "default",
          approvals: [],
          isDependentTask: false,
        },
        {
          _id: "checklist-2",
          checklistNumber: "CHK-002",
          checklistName: "Weekly Fire Audit",
          checklistSourceSite: { name: "Branch" },
          assignedToEmployee: {
            employeeCode: "EMP-002",
            employeeName: "Asha",
          },
          priority: "high",
          scheduleType: "weekly",
          scheduleTime: "10:00",
          startDate: "2026-04-26T00:00:00.000Z",
          endDate: null,
          endTime: "",
          nextOccurrenceAt: null,
          status: true,
          approvalHierarchy: "default",
          approvals: [],
          isDependentTask: false,
        },
      ],
    });

    render(
      <MemoryRouter>
        <ChecklistList />
      </MemoryRouter>
    );

    expect(await screen.findByText("Daily Safety Walk")).toBeInTheDocument();
    expect(screen.getByText("Weekly Fire Audit")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/filter by schedule/i), {
      target: { value: "daily" },
    });
    fireEvent.change(screen.getByLabelText(/filter by priority/i), {
      target: { value: "medium" },
    });
    fireEvent.change(screen.getByLabelText(/filter by employee/i), {
      target: { value: "Karthick" },
    });
    fireEvent.click(screen.getByRole("button", { name: /apply table filters/i }));

    expect(screen.getByText("Daily Safety Walk")).toBeInTheDocument();
    expect(screen.queryByText("Weekly Fire Audit")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /clear table filters/i }));

    expect(screen.getByText("Weekly Fire Audit")).toBeInTheDocument();
  });

  test("previews checklist import and saves only after OK", async () => {
    window.alert = vi.fn();
    api.get.mockResolvedValue({ data: [] });
    api.post
      .mockResolvedValueOnce({
        data: {
          preview: true,
          processedCount: 1,
          readyCount: 1,
          skippedCount: 0,
          failedCount: 0,
          ignoredRows: 0,
          readyRows: [
            {
              rowNumber: 2,
              checklistNumber: "Auto number",
              checklistName: "Daily Safety Walk",
              assignedSite: "HQ",
              assignedEmployee: "EMP-001 - Asha",
              scheduleType: "Daily",
              status: "Active",
            },
          ],
          skippedRows: [],
          failedRows: [],
        },
      })
      .mockResolvedValueOnce({
        data: {
          createdCount: 1,
          generatedTaskCount: 0,
          skippedCount: 0,
          failedCount: 0,
          ignoredRows: 0,
          skippedRows: [],
          failedRows: [],
        },
      });

    render(
      <MemoryRouter>
        <ChecklistList />
      </MemoryRouter>
    );

    const file = new File(["preview"], "checklists.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = document.querySelector('input[type="file"]');

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/preview checklist import/i)).toBeInTheDocument();
    expect(screen.getByText("Daily Safety Walk")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post.mock.calls[0][1].get("mode")).toBe("preview");

    fireEvent.click(screen.getByTestId("checklist-import-ok"));

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(api.post.mock.calls[1][1].get("mode")).toBe("commit");
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("1 checklist master created"));
  });

  test("canceling checklist import preview does not save data", async () => {
    api.get.mockResolvedValue({ data: [] });
    api.post.mockResolvedValueOnce({
      data: {
        preview: true,
        processedCount: 1,
        readyCount: 1,
        skippedCount: 0,
        failedCount: 0,
        ignoredRows: 0,
        readyRows: [
          {
            rowNumber: 2,
            checklistNumber: "Auto number",
            checklistName: "Daily Safety Walk",
          },
        ],
        skippedRows: [],
        failedRows: [],
      },
    });

    render(
      <MemoryRouter>
        <ChecklistList />
      </MemoryRouter>
    );

    const file = new File(["preview"], "checklists.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const input = document.querySelector('input[type="file"]');

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/preview checklist import/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("checklist-import-cancel"));

    await waitFor(() =>
      expect(screen.queryByTestId("checklist-import-preview-modal")).not.toBeInTheDocument()
    );
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});
