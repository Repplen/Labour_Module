import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import DesignationMaster from "../pages/masters/DesignationMaster";

vi.mock("../api/axios", () => ({
  default: {
    defaults: { baseURL: "/api" },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from "../api/axios";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeDesignation = (overrides = {}) => ({
  _id: "64f1a2b3c4d5e6f7a8b9c0d1",
  name: "Software Engineer",
  isActive: true,
  ...overrides,
});

const renderComponent = () => render(<DesignationMaster />);

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: [] });
});

// ═════════════════════════════════════════════════════════════════════════════
// Page load — no validation errors on initial render
// ═════════════════════════════════════════════════════════════════════════════

describe("page load", () => {
  test("renders without any validation error on load", async () => {
    renderComponent();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/designations"));

    expect(screen.queryByText(/required/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/at least 2/i)).not.toBeInTheDocument();
  });

  test("shows 'No designations found' when the list is empty", async () => {
    renderComponent();
    expect(await screen.findByText(/no designations found/i)).toBeInTheDocument();
  });

  test("shows designations returned by the API", async () => {
    api.get.mockResolvedValue({
      data: [
        makeDesignation({ name: "Software Engineer" }),
        makeDesignation({ _id: "id2", name: "HR Manager" }),
      ],
    });

    renderComponent();

    expect(await screen.findByText("Software Engineer")).toBeInTheDocument();
    expect(screen.getByText("HR Manager")).toBeInTheDocument();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Input validation — live error display
// ═════════════════════════════════════════════════════════════════════════════

describe("input validation", () => {
  test("shows 'required' error only after clicking Save with empty input", async () => {
    renderComponent();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    expect(screen.queryByText(/required/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /save designation/i }));

    expect(screen.getByText(/designation name is required/i)).toBeInTheDocument();
  });

  test("shows 'required' error after touching the field then clearing it", async () => {
    renderComponent();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(/software engineer/i);
    fireEvent.change(input, { target: { value: "A" } });
    fireEvent.change(input, { target: { value: "" } });

    expect(screen.getByText(/designation name is required/i)).toBeInTheDocument();
  });

  test("shows 'at least 2 characters' error for a single character", async () => {
    renderComponent();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText(/software engineer/i), {
      target: { value: "A" },
    });

    expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument();
  });

  test("shows 'must not exceed 100' error for an overlong name", async () => {
    renderComponent();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText(/software engineer/i), {
      target: { value: "A".repeat(101) },
    });

    expect(screen.getByText(/must not exceed 100/i)).toBeInTheDocument();
  });

  test("shows 'letter or number' error for symbol-only input", async () => {
    renderComponent();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText(/software engineer/i), {
      target: { value: "###" },
    });

    expect(screen.getByText(/letter or number/i)).toBeInTheDocument();
  });

  test("shows 'already exists' error for a name matching the list (case-insensitive)", async () => {
    api.get.mockResolvedValue({
      data: [makeDesignation({ name: "Software Engineer" })],
    });

    renderComponent();
    await screen.findByText("Software Engineer");

    fireEvent.change(screen.getByPlaceholderText(/software engineer/i), {
      target: { value: "software engineer" },
    });

    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
  });

  test("does NOT flag duplicate when editing the same record", async () => {
    const d = makeDesignation({ name: "Software Engineer" });
    api.get.mockResolvedValue({ data: [d] });

    renderComponent();
    await screen.findByText("Software Engineer");

    fireEvent.click(screen.getAllByRole("button", { name: /edit/i })[0]);
    // Input is pre-filled with the same name — should not be a duplicate
    expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Save button state
// ═════════════════════════════════════════════════════════════════════════════

describe("Save button", () => {
  test("Save button is enabled for a valid new name", async () => {
    renderComponent();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText(/software engineer/i), {
      target: { value: "HR Manager" },
    });

    expect(screen.getByRole("button", { name: /save designation/i })).not.toBeDisabled();
  });

  test("Save button is disabled when there is a live validation error", async () => {
    renderComponent();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText(/software engineer/i), {
      target: { value: "A" },
    });

    expect(screen.getByRole("button", { name: /save designation/i })).toBeDisabled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Add success — shows toast
// ═════════════════════════════════════════════════════════════════════════════

describe("add designation", () => {
  test("shows success toast after adding a designation", async () => {
    api.post.mockResolvedValue({ data: makeDesignation() });

    renderComponent();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText(/software engineer/i), {
      target: { value: "Software Engineer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save designation/i }));

    expect(await screen.findByText(/added successfully/i)).toBeInTheDocument();
  });

  test("clears the input after a successful add", async () => {
    api.post.mockResolvedValue({ data: makeDesignation() });

    renderComponent();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(/software engineer/i);
    fireEvent.change(input, { target: { value: "Software Engineer" } });
    fireEvent.click(screen.getByRole("button", { name: /save designation/i }));

    await waitFor(() => expect(input.value).toBe(""));
  });

  test("displays backend error when add fails with a field error", async () => {
    api.post.mockRejectedValue({
      response: {
        data: {
          errors: [{ message: "This designation name already exists." }],
        },
      },
    });

    renderComponent();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText(/software engineer/i), {
      target: { value: "Software Engineer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save designation/i }));

    expect(
      await screen.findByText(/this designation name already exists/i)
    ).toBeInTheDocument();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Edit mode
// ═════════════════════════════════════════════════════════════════════════════

describe("edit mode", () => {
  test("clicking Edit prefills the form with the designation name", async () => {
    api.get.mockResolvedValue({
      data: [makeDesignation({ name: "Software Engineer" })],
    });

    renderComponent();
    await screen.findByText("Software Engineer");

    fireEvent.click(screen.getAllByRole("button", { name: /edit/i })[0]);

    expect(screen.getByPlaceholderText(/software engineer/i).value).toBe(
      "Software Engineer"
    );
  });

  test("shows 'Update Designation' and Cancel buttons in edit mode", async () => {
    api.get.mockResolvedValue({
      data: [makeDesignation({ name: "Software Engineer" })],
    });

    renderComponent();
    await screen.findByText("Software Engineer");

    fireEvent.click(screen.getAllByRole("button", { name: /edit/i })[0]);

    expect(screen.getByRole("button", { name: /update designation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  test("Cancel resets the form and hides Cancel button", async () => {
    api.get.mockResolvedValue({
      data: [makeDesignation({ name: "Software Engineer" })],
    });

    renderComponent();
    await screen.findByText("Software Engineer");

    fireEvent.click(screen.getAllByRole("button", { name: /edit/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("button", { name: /cancel/i })).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/software engineer/i).value).toBe("");
  });

  test("shows success toast after updating a designation", async () => {
    api.get.mockResolvedValue({
      data: [makeDesignation({ name: "Software Engineer" })],
    });
    api.put.mockResolvedValue({ data: makeDesignation({ name: "Senior Engineer" }) });

    renderComponent();
    await screen.findByText("Software Engineer");

    fireEvent.click(screen.getAllByRole("button", { name: /edit/i })[0]);
    fireEvent.change(screen.getByPlaceholderText(/software engineer/i), {
      target: { value: "Senior Engineer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /update designation/i }));

    expect(await screen.findByText(/updated successfully/i)).toBeInTheDocument();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Delete — ConfirmDialog flow
// ═════════════════════════════════════════════════════════════════════════════

describe("delete designation", () => {
  test("clicking Delete opens the ConfirmDialog", async () => {
    api.get.mockResolvedValue({
      data: [makeDesignation({ name: "Software Engineer" })],
    });

    renderComponent();
    await screen.findByText("Software Engineer");

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/delete designation/i)).toBeInTheDocument();
  });

  test("shows the designation name in the confirm dialog", async () => {
    api.get.mockResolvedValue({
      data: [makeDesignation({ name: "Software Engineer" })],
    });

    renderComponent();
    await screen.findByText("Software Engineer");

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Software Engineer");
  });

  test("Cancel closes the dialog without deleting", async () => {
    api.get.mockResolvedValue({
      data: [makeDesignation({ name: "Software Engineer" })],
    });

    renderComponent();
    await screen.findByText("Software Engineer");

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();
  });

  test("confirming deletion removes the row and shows success toast", async () => {
    api.get.mockResolvedValue({
      data: [makeDesignation({ name: "Software Engineer" })],
    });
    api.delete.mockResolvedValue({});

    renderComponent();
    await screen.findByText("Software Engineer");

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    fireEvent.click(screen.getByRole("button", { name: /yes, delete/i }));

    expect(await screen.findByText(/deleted successfully/i)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("shows error toast when delete fails", async () => {
    api.get.mockResolvedValue({
      data: [makeDesignation({ name: "Software Engineer" })],
    });
    api.delete.mockRejectedValue({
      response: {
        data: {
          message: "Cannot delete designation while it is assigned to one or more employees.",
        },
      },
    });

    renderComponent();
    await screen.findByText("Software Engineer");

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    fireEvent.click(screen.getByRole("button", { name: /yes, delete/i }));

    expect(
      await screen.findByText(/cannot delete designation while it is assigned/i)
    ).toBeInTheDocument();
  });
});
