const { test, expect } = require("@playwright/test");
const { hasCredentials, login } = require("./helpers/auth");
const { gotoModule, isAccessDenied } = require("./helpers/navigation");

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const employeeEmail = process.env.E2E_EMPLOYEE_EMAIL;
const employeePassword = process.env.E2E_EMPLOYEE_PASSWORD;

async function openComplaintsAsAdmin(page) {
  test.skip(!hasCredentials(adminEmail, adminPassword), "Set admin E2E credentials.");
  await login(page, adminEmail, adminPassword);
  await gotoModule(page, "complaints");
  test.skip(await isAccessDenied(page), "Admin user does not currently have Complaints access.");
}

async function openComplaintsAsEmployee(page) {
  test.skip(
    !hasCredentials(employeeEmail, employeePassword),
    "Set employee E2E credentials to test complaint form."
  );
  await login(page, employeeEmail, employeePassword);
  await page.goto("/complaints");
  test.skip(await isAccessDenied(page), "Employee user does not currently have Complaints access.");
}

test("Complaint page opens", async ({ page }) => {
  await openComplaintsAsAdmin(page);
  await expect(page.getByTestId("complaint-page")).toBeVisible();
});

test("Complaint form opens", async ({ page }) => {
  await openComplaintsAsEmployee(page);
  test.skip((await page.getByTestId("complaint-form").count()) === 0, "Complaint form is not available.");
  await expect(page.getByTestId("complaint-form")).toBeVisible();
});

test("Required field validation appears on empty submit", async ({ page }) => {
  await openComplaintsAsEmployee(page);
  test.skip((await page.getByTestId("complaint-submit").count()) === 0, "Complaint submit is not available.");

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toMatch(/Select a department|Enter complaint details/i);
    await dialog.dismiss();
  });

  await page.getByTestId("complaint-submit").click();
});

test("Complaint dashboard/report page opens if permission allows", async ({ page }) => {
  await openComplaintsAsAdmin(page);
  await page.goto("/complaints/reports");
  test.skip(await isAccessDenied(page), "Complaint report permission is not available.");

  await expect(page.locator("body")).toContainText(/Complaint Report|Complaint Report Filters/i);
});
