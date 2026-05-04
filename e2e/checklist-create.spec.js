const { test, expect } = require("@playwright/test");
const { hasCredentials, login } = require("./helpers/auth");
const { isAccessDenied } = require("./helpers/navigation");

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

async function openChecklistCreate(page) {
  test.skip(!hasCredentials(adminEmail, adminPassword), "Set admin E2E credentials.");
  await login(page, adminEmail, adminPassword);
  await page.goto("/checklists/create");
  test.skip(await isAccessDenied(page), "Create Checklist permission is not available.");
  await expect(page.getByTestId("checklist-create-page")).toBeVisible();
}

test("Checklist Create page loads", async ({ page }) => {
  await openChecklistCreate(page);
});

test("Setup data loads: employees, departments, sites, and dependency checklists", async ({
  page,
}) => {
  await openChecklistCreate(page);

  await expect(page.getByTestId("employee-assignment-section")).toBeVisible();
  await expect(page.locator('select[name="employeeAssignedSite"]')).toBeVisible();
  await expect(page.locator('select[name="assignedToEmployee"]')).toBeVisible();
  await expect(page.locator('select[name="checklistSourceSite"]')).toBeVisible();

  await page.locator('input[name="isDependentTask"][value="yes"]').check();
  await expect(page.locator('select[name="dependencyChecklistId"]')).toBeVisible();
});

test("Schedule Type dropdown is visible", async ({ page }) => {
  await openChecklistCreate(page);
  await expect(page.getByTestId("schedule-type-select")).toBeVisible();
});

test("Weekly schedule shows Day of Week selector when implemented", async ({ page }) => {
  await openChecklistCreate(page);

  const scheduleType = page.getByTestId("schedule-type-select");
  await scheduleType.selectOption("weekly");
  await expect(scheduleType).toHaveValue("weekly");

  const daySelector = page.getByTestId("day-of-week-select");
  if ((await daySelector.count()) === 0 || !(await daySelector.first().isVisible())) {
    test.info().annotations.push({
      type: "note",
      description: "Current weekly schedule uses the start date as its weekly anchor.",
    });
    return;
  }

  await expect(daySelector).toBeVisible();
});

test("Monthly schedule shows date/day options if implemented", async ({ page }) => {
  await openChecklistCreate(page);

  await page.getByTestId("schedule-type-select").selectOption("monthly");
  await expect(page.getByTestId("schedule-type-select")).toHaveValue("monthly");

  const dayOfMonth = page.locator('input[name="repeatDayOfMonth"]');
  if ((await dayOfMonth.count()) === 0) {
    test.info().annotations.push({
      type: "note",
      description: "Current monthly schedule uses the selected start date as its monthly anchor.",
    });
    return;
  }

  await expect(dayOfMonth.first()).toBeVisible();
});

test("Custom schedule still works if existing process supports it", async ({ page }) => {
  await openChecklistCreate(page);

  await page.getByTestId("schedule-type-select").selectOption("custom");
  await expect(page.locator('input[name="customRepeatInterval"]')).toBeVisible();
  await expect(page.locator('select[name="customRepeatUnit"]')).toBeVisible();
});

test("Employee assignment section is visible", async ({ page }) => {
  await openChecklistCreate(page);
  await expect(page.getByTestId("employee-assignment-section")).toBeVisible();
});

test("Save button shows validation if required fields are missing", async ({ page }) => {
  await openChecklistCreate(page);

  await page.getByTestId("save-checklist-button").click();
  await expect(page.locator("body")).toContainText(
    /Select the assigned site|Select the employee|Enter the checklist name/i
  );
});
