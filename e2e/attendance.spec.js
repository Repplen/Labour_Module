const { test, expect } = require("@playwright/test");
const { hasCredentials, login } = require("./helpers/auth");
const { gotoModule, isAccessDenied } = require("./helpers/navigation");

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const employeeEmail = process.env.E2E_EMPLOYEE_EMAIL;
const employeePassword = process.env.E2E_EMPLOYEE_PASSWORD;

async function openAttendanceAsAdmin(page) {
  test.skip(!hasCredentials(adminEmail, adminPassword), "Set admin E2E credentials.");
  await login(page, adminEmail, adminPassword);
  await gotoModule(page, "attendance");
  test.skip(await isAccessDenied(page), "Admin user does not currently have Attendance access.");
}

test("Attendance dashboard/page opens", async ({ page }) => {
  await openAttendanceAsAdmin(page);
  await expect(page.getByTestId("attendance-page")).toBeVisible();
});

test("Attendance table/cards load", async ({ page }) => {
  await openAttendanceAsAdmin(page);
  await expect(page.getByTestId("attendance-table")).toBeVisible();
  await expect(page.locator("body")).toContainText(/Present|Absent|Employee Attendance Summary/i);
});

test("Daily attendance page opens if available", async ({ page }) => {
  test.skip(!hasCredentials(adminEmail, adminPassword), "Set admin E2E credentials.");
  await login(page, adminEmail, adminPassword);
  await page.goto("/attendance/daily");
  test.skip(await isAccessDenied(page), "Daily Attendance Entry permission is not available.");

  await expect(page.locator("body")).toContainText(/Daily Attendance Entry|Attendance Rows/i);
});

test("Self-attendance page opens for employee if employee credentials are available", async ({
  page,
}) => {
  test.skip(
    !hasCredentials(employeeEmail, employeePassword),
    "Set employee E2E credentials to test self attendance."
  );

  await login(page, employeeEmail, employeePassword);
  await page.goto("/attendance/self");
  test.skip(await isAccessDenied(page), "Employee user does not currently have self attendance access.");

  await expect(page.locator("body")).toContainText(/My Attendance|Self check-in/i);
});
