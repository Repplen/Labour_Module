import { describe, expect, test } from "vitest";
import {
  formatTaskTimeStatusLabel,
  getTaskTimeStatusBadgeClass,
} from "../utils/checklistDisplay";

describe("checklist report time status display", () => {
  const targetDateTime = "2026-05-11T12:30:00.000Z";

  test("shows on time when submitted before target time on the same day", () => {
    expect(
      formatTaskTimeStatusLabel({
        targetDateTime,
        submittedAt: "2026-05-11T12:00:00.000Z",
      })
    ).toBe("On Time");
  });

  test("shows delay with calendar day count", () => {
    const task = {
      targetDateTime,
      submittedAt: "2026-05-12T03:30:00.000Z",
    };

    expect(formatTaskTimeStatusLabel(task)).toBe("Delay - 1 day");
    expect(getTaskTimeStatusBadgeClass(task)).toBe("bg-danger");
  });

  test("shows advance with calendar day count", () => {
    const task = {
      targetDateTime,
      submittedAt: "2026-05-10T11:30:00.000Z",
    };

    expect(formatTaskTimeStatusLabel(task)).toBe("Advance - 1 day");
    expect(getTaskTimeStatusBadgeClass(task)).toBe("bg-info text-dark");
  });

  test("shows pending when submitted at is empty", () => {
    expect(formatTaskTimeStatusLabel({ targetDateTime })).toBe("Pending");
  });
});
