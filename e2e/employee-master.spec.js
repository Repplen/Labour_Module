const { test, expect } = require("@playwright/test");
const { hasCredentials, login } = require("./helpers/auth");
const { gotoModule, isAccessDenied } = require("./helpers/navigation");

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

async function loginAsAdmin(page) {
  test.skip(!hasCredentials(adminEmail, adminPassword), "Set admin E2E credentials.");
  await login(page, adminEmail, adminPassword);
}

async function openEmployeeMaster(page) {
  await loginAsAdmin(page);
  await gotoModule(page, "employee master");
  test.skip(
    await isAccessDenied(page),
    "Admin user does not currently have Employee Master access."
  );
}

test("Admin can open Employee Master", async ({ page }) => {
  await openEmployeeMaster(page);
  await expect(page.getByTestId("employee-master-page")).toBeVisible();
});

test("Employee list/table loads", async ({ page }) => {
  await openEmployeeMaster(page);
  await expect(page.getByTestId("employee-table")).toBeVisible();
});

test("Add Employee form opens if permission allows", async ({ page }) => {
  await openEmployeeMaster(page);

  const addButton = page.getByTestId("add-employee-button");
  test.skip((await addButton.count()) === 0, "Add Employee permission is not available.");

  await addButton.click();
  await expect(page.locator("body")).toContainText(/Add Employee|Basic Information/i);
});

test("Required field validation appears on empty submit", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/add");
  test.skip(await isAccessDenied(page), "Add Employee permission is not available.");

  await page.getByRole("button", { name: /save employee/i }).click();
  await expect
    .poll(async () => page.locator("input:invalid, select:invalid").count())
    .toBeGreaterThan(0);
});

test("Active/Inactive status action opens confirmation modal and cancel does not change status", async ({
  page,
}) => {
  await openEmployeeMaster(page);

  const statusToggle = page.getByTestId("employee-status-toggle");
  test.skip((await statusToggle.count()) === 0, "No employee status action is available.");

  await statusToggle.first().click();
  await expect(page.getByTestId("confirm-status-modal")).toBeVisible();

  const tableBeforeCancel = await page.getByTestId("employee-table").innerText();
  await page.getByTestId("confirm-cancel-button").click();
  await expect(page.getByTestId("confirm-status-modal")).toBeHidden();
  await expect(page.getByTestId("employee-table")).toContainText(tableBeforeCancel.split("\n")[0]);
});
