const { test, expect } = require("@playwright/test");
const { hasCredentials, login, logout } = require("./helpers/auth");
const { isAccessDenied } = require("./helpers/navigation");

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

const smokeModules = [
  { name: "Dashboard", path: "/dashboard-1", text: /Overview|Dashboard/i },
  { name: "Employee Master", path: "/employees", text: /Employee Directory|Employee Master/i },
  { name: "Checklist Master", path: "/checklists", text: /Checklist Master|My Checklist Tasks/i },
  { name: "Poll Master", path: "/polls", text: /Polling System|Assigned Polls/i },
  { name: "Attendance", path: "/attendance", text: /Employee Attendance Dashboard|Attendance/i },
  { name: "Complaints", path: "/complaints", text: /Complaints Dashboard|Complaints/i },
];

test("Smoke: Login, main modules, and Logout", async ({ page }) => {
  test.skip(!hasCredentials(adminEmail, adminPassword), "Set admin E2E credentials.");

  await login(page, adminEmail, adminPassword);

  for (const smokeModule of smokeModules) {
    await page.goto(smokeModule.path);
    if (await isAccessDenied(page)) {
      test.info().annotations.push({
        type: "note",
        description: `${smokeModule.name} is not available for this test account.`,
      });
      continue;
    }

    await expect(page.locator("body")).toContainText(smokeModule.text);
  }

  await logout(page);
});
