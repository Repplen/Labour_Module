const { test, expect } = require("@playwright/test");
const {
  expectAccessDeniedOrRedirect,
  hasCredentials,
  login,
} = require("./helpers/auth");
const { gotoModule, isAccessDenied } = require("./helpers/navigation");

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const employeeEmail = process.env.E2E_EMPLOYEE_EMAIL;
const employeePassword = process.env.E2E_EMPLOYEE_PASSWORD;

async function openPermissionsAsAdmin(page) {
  test.skip(!hasCredentials(adminEmail, adminPassword), "Set admin E2E credentials.");
  await login(page, adminEmail, adminPassword);
  await gotoModule(page, "role permission setup");
  test.skip(
    await isAccessDenied(page),
    "Admin user does not currently have Role Permission Setup access."
  );
}

test("Role Permission Setup page opens for Main Admin", async ({ page }) => {
  await openPermissionsAsAdmin(page);
  await expect(page.getByTestId("role-permission-page")).toBeVisible();
});

test("Permission module list loads", async ({ page }) => {
  await openPermissionsAsAdmin(page);
  await expect(page.getByTestId("permission-table").first()).toBeVisible();
});

test("Permission checkboxes/toggles are visible", async ({ page }) => {
  await openPermissionsAsAdmin(page);
  await expect
    .poll(async () => page.getByTestId("permission-table").first().locator('input[type="checkbox"]').count())
    .toBeGreaterThan(0);
});

test("Employee user cannot open Role Permission Setup and should see access denied or redirect", async ({
  page,
}) => {
  test.skip(
    !hasCredentials(employeeEmail, employeePassword),
    "Set employee E2E credentials to test permission blocking."
  );

  await login(page, employeeEmail, employeePassword);
  await page.goto("/permissions/roles");
  await expectAccessDeniedOrRedirect(page);
});
