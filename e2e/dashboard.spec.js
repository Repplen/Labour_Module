const { test, expect } = require("@playwright/test");
const { hasCredentials, login } = require("./helpers/auth");
const { gotoModule, isAccessDenied } = require("./helpers/navigation");

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

async function loginAsAdmin(page) {
  test.skip(
    !hasCredentials(adminEmail, adminPassword),
    "Set admin E2E credentials to run dashboard tests."
  );
  await login(page, adminEmail, adminPassword);
}

async function openDashboard(page) {
  await gotoModule(page, "dashboard");
  test.skip(await isAccessDenied(page), "Admin user does not currently have dashboard access.");
}

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
});

test("Admin dashboard loads after login", async ({ page }) => {
  await openDashboard(page);
  await expect(page.getByTestId("dashboard-page")).toBeVisible();
});

test("Dashboard cards or main heading are visible", async ({ page }) => {
  await openDashboard(page);

  const dashboardCards = page.getByTestId("dashboard-card");
  if ((await dashboardCards.count()) > 0) {
    await expect(dashboardCards.first()).toBeVisible();
    return;
  }

  await expect(page.locator("body")).toContainText(/Overview|Dashboard/i);
});

test("Sidebar/navbar is visible", async ({ page }) => {
  await expect(page.getByTestId("app-navbar")).toBeVisible();
});

test("Main module links are visible based on permissions", async ({ page }) => {
  const navbar = page.getByTestId("app-navbar");
  await expect(navbar).toBeVisible();

  for (const menuName of ["Workspace", "Attendance", "Admin"]) {
    const menu = navbar.getByRole("button", { name: new RegExp(menuName, "i") });
    if ((await menu.count()) > 0) {
      await menu.first().click();
    }
  }

  await expect(navbar).toContainText(
    /Employee Master|Checklist|Polling|Attendance|Complaint|Users|Role Permission/i
  );
});
