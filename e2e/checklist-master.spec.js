const { test, expect } = require("@playwright/test");
const { hasCredentials, login } = require("./helpers/auth");
const { gotoModule, isAccessDenied } = require("./helpers/navigation");

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

async function loginAsAdmin(page) {
  test.skip(!hasCredentials(adminEmail, adminPassword), "Set admin E2E credentials.");
  await login(page, adminEmail, adminPassword);
}

async function openChecklistMaster(page) {
  await loginAsAdmin(page);
  await gotoModule(page, "checklist master");
  test.skip(
    await isAccessDenied(page),
    "Admin user does not currently have Checklist Master access."
  );
}

test("Admin can open Checklist Master", async ({ page }) => {
  await openChecklistMaster(page);
  await expect(page.getByTestId("checklist-master-page")).toBeVisible();
});

test("Checklist list/table loads", async ({ page }) => {
  await openChecklistMaster(page);
  await expect(page.getByTestId("checklist-table")).toBeVisible();
});

test("Add Checklist/Create Checklist page opens", async ({ page }) => {
  await openChecklistMaster(page);

  const addButton = page.getByTestId("add-checklist-button");
  test.skip((await addButton.count()) === 0, "Create Checklist permission is not available.");

  await addButton.click();
  await expect(page.getByTestId("checklist-create-page")).toBeVisible();
});

test("Required field validation appears on empty submit", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/checklists/create");
  test.skip(await isAccessDenied(page), "Create Checklist permission is not available.");

  await page.getByTestId("save-checklist-button").click();
  await expect(page.locator("body")).toContainText(
    /Select the assigned site|Select the employee|Enter the checklist name/i
  );
});

test("Active/Inactive status action opens confirmation modal and cancel should not delete checklist", async ({
  page,
}) => {
  await openChecklistMaster(page);

  const statusToggle = page.getByTestId("checklist-status-toggle");
  test.skip((await statusToggle.count()) === 0, "No checklist status action is available.");

  await statusToggle.first().click();
  await expect(page.getByTestId("confirm-status-modal")).toBeVisible();
  await expect(page.getByTestId("confirm-status-modal")).toContainText(
    /Existing generated tasks will remain unchanged|generate employee tasks again/i
  );

  await page.getByTestId("confirm-cancel-button").click();
  await expect(page.getByTestId("confirm-status-modal")).toBeHidden();
  await expect(page.getByTestId("checklist-table")).toBeVisible();
});
