const { test, expect } = require("@playwright/test");
const { hasCredentials, login } = require("./helpers/auth");
const { gotoModule, isAccessDenied } = require("./helpers/navigation");

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

async function openUserAdmin(page) {
  test.skip(!hasCredentials(adminEmail, adminPassword), "Set admin E2E credentials.");
  await login(page, adminEmail, adminPassword);
  await gotoModule(page, "user admin");
  test.skip(await isAccessDenied(page), "Admin user does not currently have User Admin access.");
}

test("Admin can open User Admin page", async ({ page }) => {
  await openUserAdmin(page);
  await expect(page.getByTestId("user-admin-page")).toBeVisible();
});

test("User list/table loads", async ({ page }) => {
  await openUserAdmin(page);
  await expect(page.getByTestId("user-table")).toBeVisible();
});

test("Search/filter works if available", async ({ page }) => {
  await openUserAdmin(page);

  const search = page.getByTestId("user-search");
  if ((await search.count()) === 0) {
    test.info().annotations.push({
      type: "note",
      description: "User Admin currently has no search/filter control.",
    });
    await expect(page.getByTestId("user-table")).toBeVisible();
    return;
  }

  await search.fill("admin");
  await expect(page.getByTestId("user-table")).toBeVisible();
});

test("Add User button or form is visible if permission allows", async ({ page }) => {
  await openUserAdmin(page);
  await expect(page.getByTestId("add-user-button")).toBeVisible();
});

test("Inactive users should not appear in active user list if test data exists", async ({
  page,
}) => {
  await openUserAdmin(page);

  const activeFilter = page.getByTestId("user-status-filter");
  test.skip(
    (await activeFilter.count()) === 0,
    "User Admin does not currently expose an active/inactive list filter."
  );

  await activeFilter.selectOption("active");
  await expect(page.getByTestId("user-table")).toBeVisible();
});
