import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import api from "../api/axios";
import ChecklistTaskView from "../pages/checklists/ChecklistTaskView";

vi.mock("../api/axios", () => ({
  default: {
    defaults: {
      baseURL: "",
    },
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const buildTask = (overrides = {}) => ({
  _id: "task-1",
  taskNumber: "TASK-001",
  checklistNumber: "CHK-001",
  checklistName: "Daily Safety Walk",
  assignedEmployee: {
    _id: "employee-1",
    employeeCode: "EMP-001",
    employeeName: "Asha",
  },
  status: "open",
  currentApprovalEmployee: null,
  scheduleType: "daily",
  priority: "medium",
  approvalType: "normal",
  isNilApproval: false,
  checklistItems: [
    {
      _id: "item-1",
      checklistItemId: "item-1",
      label: "Confirm area is safe",
      detail: "",
      isRequired: true,
      employeeAnswerRemark: "",
      superiorAnswerRemark: "",
      answer: "",
      remarks: "",
      verified: false,
    },
  ],
  employeeAttachments: [],
  approvalSteps: [
    {
      approvalLevel: 1,
      approverEmployee: {
        _id: "employee-2",
        employeeCode: "EMP-002",
        employeeName: "Ravi",
      },
      status: "waiting",
      remarks: "",
      actedAt: null,
    },
  ],
  ...overrides,
});

const renderTaskView = () =>
  render(
    <MemoryRouter initialEntries={["/checklists/tasks/task-1"]}>
      <Routes>
        <Route path="/checklists/tasks/:id" element={<ChecklistTaskView />} />
      </Routes>
    </MemoryRouter>
  );

describe("checklist task attachments", () => {
  beforeEach(() => {
    localStorage.setItem("user", JSON.stringify({ id: "employee-1", role: "employee" }));

    api.get.mockResolvedValue({ data: buildTask() });
    api.post.mockResolvedValue({ data: {} });

    vi.spyOn(window, "alert").mockImplementation(() => {});
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
  });

  test("adds files from multiple selections before submitting the task", async () => {
    renderTaskView();

    const attachmentInput = await screen.findByLabelText(/^attachments$/i);
    const safetyReport = new File(["report"], "safety-report.pdf", {
      type: "application/pdf",
    });
    const sitePhoto = new File(["photo"], "site-photo.png", {
      type: "image/png",
    });

    fireEvent.change(attachmentInput, { target: { files: [safetyReport] } });
    fireEvent.change(attachmentInput, { target: { files: [sitePhoto] } });

    expect(screen.getByText("safety-report.pdf")).toBeInTheDocument();
    expect(screen.getByText("site-photo.png")).toBeInTheDocument();

    fireEvent.change(await screen.findByPlaceholderText(/enter the required answer or remark/i), {
      target: { value: "Checked and safe" },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit for approval/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/checklists/tasks/task-1/submit",
        expect.any(FormData),
        expect.objectContaining({
          headers: { "Content-Type": "multipart/form-data" },
        })
      );
    });

    const submittedPayload = api.post.mock.calls[0][1];
    const submittedAttachments = submittedPayload.getAll("attachments");

    expect(submittedAttachments.map((file) => file.name)).toEqual([
      "safety-report.pdf",
      "site-photo.png",
    ]);
  });
});

describe("checklist task voice recording", () => {
  beforeEach(() => {
    localStorage.setItem("user", JSON.stringify({ id: "employee-1", role: "employee" }));

    api.get.mockResolvedValue({ data: buildTask() });
    api.post.mockResolvedValue({ data: {} });

    vi.spyOn(window, "alert").mockImplementation(() => {});

    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:voice-preview"),
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
  });

  test("shows unsupported recorder errors inline on the task detail screen", async () => {
    renderTaskView();

    fireEvent.click(await screen.findByRole("button", { name: /record voice/i }));

    expect(
      await screen.findByText("Unable to start voice recording on this browser.")
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("checklist-voice-recorder__error");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("submits a recorded voice file as a checklist attachment", async () => {
    let recorderInstance;

    class MockMediaRecorder {
      constructor(_stream, options = {}) {
        this.mimeType = options.mimeType || "audio/webm";
        this.state = "inactive";
        recorderInstance = this;
      }

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob(["voice"], { type: "audio/webm" }),
        });
        this.onstop?.();
      }
    }

    MockMediaRecorder.isTypeSupported = vi.fn((mimeType) => mimeType === "audio/webm");

    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: MockMediaRecorder,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    });

    renderTaskView();

    fireEvent.change(await screen.findByPlaceholderText(/enter the required answer or remark/i), {
      target: { value: "Checked and safe" },
    });
    fireEvent.click(screen.getByRole("button", { name: /record voice/i }));

    await waitFor(() => expect(recorderInstance).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /^stop$/i }));

    expect(await screen.findByText(/checklist-voice-/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /submit for approval/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/checklists/tasks/task-1/submit",
        expect.any(FormData),
        expect.objectContaining({
          headers: { "Content-Type": "multipart/form-data" },
        })
      );
    });

    const submittedPayload = api.post.mock.calls[0][1];
    const submittedAttachments = submittedPayload.getAll("attachments");

    expect(submittedAttachments).toHaveLength(1);
    expect(submittedAttachments[0]).toBeInstanceOf(File);
    expect(submittedAttachments[0].type).toBe("audio/webm");
    expect(submittedAttachments[0].name).toMatch(/^checklist-voice-.*\.webm$/);
  });
});

describe("checklist task approval actions", () => {
  beforeEach(() => {
    localStorage.setItem("user", JSON.stringify({ id: "employee-2", role: "employee" }));

    vi.spyOn(window, "alert").mockImplementation(() => {});
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  const buildApprovalTask = (overrides = {}) =>
    buildTask({
      status: "submitted",
      currentApprovalEmployee: {
        _id: "employee-2",
        employeeCode: "EMP-002",
        employeeName: "Ravi",
      },
      approvalSteps: [
        {
          approvalLevel: 1,
          approverEmployee: {
            _id: "employee-2",
            employeeCode: "EMP-002",
            employeeName: "Ravi",
          },
          status: "pending",
          remarks: "",
          actedAt: null,
        },
      ],
      ...overrides,
    });

  test("shows approve and reject only for normal approval submissions", async () => {
    api.get.mockResolvedValue({ data: buildApprovalTask() });
    api.post.mockResolvedValue({ data: {} });

    renderTaskView();

    expect(await screen.findByRole("button", { name: /^approve$/i })).toBeInTheDocument();
    const rejectButton = screen.getByRole("button", { name: /^reject$/i });
    expect(rejectButton).toBeInTheDocument();
    expect(rejectButton).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/approval or rejection summary/i), {
      target: { value: "Answer is incorrect" },
    });
    expect(rejectButton).not.toBeDisabled();
    expect(screen.queryByRole("button", { name: /nil approve/i })).not.toBeInTheDocument();
  });

  test("shows nil approve and reject only for nil approval submissions", async () => {
    api.get.mockResolvedValue({
      data: buildApprovalTask({
        status: "nil_for_approval",
        approvalType: "nil",
        isNilApproval: true,
        enableMark: false,
        baseMark: null,
        finalMark: null,
      }),
    });
    api.post.mockResolvedValue({ data: {} });

    renderTaskView();

    expect(await screen.findByRole("button", { name: /nil approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^reject$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^approve$/i })).not.toBeInTheDocument();
  });
});

describe("checklist task rejection correction", () => {
  beforeEach(() => {
    localStorage.setItem("user", JSON.stringify({ id: "employee-1", role: "employee" }));

    vi.spyOn(window, "alert").mockImplementation(() => {});
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  test("lets the assigned employee correct and resubmit a rejected normal task", async () => {
    api.get.mockResolvedValue({
      data: buildTask({
        status: "rejected",
        employeeRemarks: "Original summary",
        rejectedBy: {
          _id: "employee-2",
          employeeCode: "EMP-002",
          employeeName: "Ravi",
        },
        rejectedAt: "2026-05-01T10:00:00.000Z",
        rejectionRemarks: "Answer is incorrect",
        approvalSteps: [
          {
            approvalLevel: 1,
            approverEmployee: {
              _id: "employee-2",
              employeeCode: "EMP-002",
              employeeName: "Ravi",
            },
            status: "rejected",
            remarks: "Answer is incorrect",
            actedAt: "2026-05-01T10:00:00.000Z",
          },
        ],
        approvalHistory: [
          {
            _id: "history-1",
            action: "submitted",
            actorEmployee: {
              _id: "employee-1",
              employeeCode: "EMP-001",
              employeeName: "Asha",
            },
            remarks: "",
            actedAt: "2026-05-01T09:00:00.000Z",
          },
          {
            _id: "history-2",
            action: "rejected",
            actorEmployee: {
              _id: "employee-2",
              employeeCode: "EMP-002",
              employeeName: "Ravi",
            },
            remarks: "Answer is incorrect",
            actedAt: "2026-05-01T10:00:00.000Z",
          },
        ],
        checklistItems: [
          {
            _id: "item-1",
            checklistItemId: "item-1",
            label: "Confirm area is safe",
            detail: "",
            isRequired: true,
            employeeAnswerRemark: "Not checked",
            superiorAnswerRemark: "Incorrect",
            answer: "Not checked",
            remarks: "Not checked",
            verified: true,
          },
        ],
      }),
    });
    api.post.mockResolvedValue({ data: {} });

    renderTaskView();

    expect(await screen.findByText("Rejection Reason")).toBeInTheDocument();
    expect(screen.getAllByText("Answer is incorrect").length).toBeGreaterThan(0);
    expect(screen.getByText("Activity History")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /nil for approval/i })).not.toBeInTheDocument();

    const answerInput = screen.getByDisplayValue("Not checked");
    fireEvent.change(answerInput, { target: { value: "Checked and safe now" } });

    fireEvent.click(screen.getByRole("button", { name: /submit for approval/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/checklists/tasks/task-1/submit",
        expect.any(FormData),
        expect.objectContaining({
          headers: { "Content-Type": "multipart/form-data" },
        })
      );
    });

    const submittedPayload = api.post.mock.calls[0][1];
    expect(submittedPayload.get("submissionType")).toBe("normal");
    expect(submittedPayload.get("itemResponses")).toContain("Checked and safe now");
  });
});
