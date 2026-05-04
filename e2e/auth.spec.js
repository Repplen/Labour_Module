const { test, expect } = require("@playwright/test");
const {
  expectAccessDeniedOrRedirect,
  expectLoggedIn,
  hasCredentials,
  login,
  logout,
} = require("./helpers/auth");
const { generateUniqueEmail } = require("./helpers/testData");

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

async function loginAsAdmin(page) {
  test.skip(
    !hasCredentials(adminEmail, adminPassword),
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD in e2e/.env to run authenticated tests."
  );
  await login(page, adminEmail, adminPassword);
}

test("Login page loads", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByTestId("login-email")).toBeVisible();
  await expect(page.getByTestId("login-password")).toBeVisible();
  await expect(page.getByTestId("login-submit")).toBeVisible();
});

test("Admin can login successfully", async ({ page }) => {
  await loginAsAdmin(page);
  await expectLoggedIn(page);
});

test("Invalid login shows error message", async ({ page }) => {
  await page.goto("/login");

  await page.getByTestId("login-email").fill(generateUniqueEmail("invalid-login"));
  await page.getByTestId("login-password").fill("not-the-right-password");
  await page.getByTestId("login-submit").click();

  await expect(page.getByTestId("login-error")).toContainText(
    /invalid|password|login|not found|failed/i
  );
});

test("Logout works", async ({ page }) => {
  await loginAsAdmin(page);
  await logout(page);

  await expect(page.getByTestId("login-submit")).toBeVisible();
});

test("Protected route redirects unauthenticated user to login or access denied", async ({
  page,
}) => {
  await page.goto("/employees");
  await expectAccessDeniedOrRedirect(page);
});
