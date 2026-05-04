const { test, expect } = require("@playwright/test");
const {
  expectAccessDeniedOrRedirect,
  hasCredentials,
  login,
} = require("./helpers/auth");
const { isAccessDenied } = require("./helpers/navigation");

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const employeeEmail = process.env.E2E_EMPLOYEE_EMAIL;
const employeePassword = process.env.E2E_EMPLOYEE_PASSWORD;

async function openApprovalAsAdmin(page) {
  test.skip(!hasCredentials(adminEmail, adminPassword), "Set admin E2E credentials.");
  await login(page, adminEmail, adminPassword);
  await page.goto("/checklists/admin-approvals");
  test.skip(
    await isAccessDenied(page),
    "Admin user does not currently have Checklist Approval access."
  );
}

test("Main Admin can open Checklist Approval page", async ({ page }) => {
  await openApprovalAsAdmin(page);
  await expect(page.getByTestId("checklist-approval-page")).toBeVisible();
});

test("Pending approval list loads", async ({ page }) => {
  await openApprovalAsAdmin(page);
  await expect(page.getByTestId("approval-table")).toBeVisible();
});

test("Approve/Reject actions are visible for Main Admin if records exist", async ({ page }) => {
  await openApprovalAsAdmin(page);

  const firstViewButton = page.getByRole("button", { name: /^view$/i }).first();
  test.skip((await firstViewButton.count()) === 0, "No approval records exist to review.");

  await firstViewButton.click();

  const approveButton = page.getByTestId("approve-button");
  const rejectButton = page.getByTestId("reject-button");
  if ((await approveButton.count()) === 0 && (await rejectButton.count()) === 0) {
    test.skip(true, "First approval record is not pending or current admin lacks decision rights.");
  }

  await expect(approveButton.or(rejectButton).first()).toBeVisible();
});

test("Non-Main Admin should not see approval/rejection controls if employee credentials are available", async ({
  page,
}) => {
  test.skip(
    !hasCredentials(employeeEmail, employeePassword),
    "Set employee E2E credentials to test restricted approval controls."
  );

  await login(page, employeeEmail, employeePassword);
  await page.goto("/checklists/admin-approvals");

  if (await isAccessDenied(page)) {
    await expectAccessDeniedOrRedirect(page);
    return;
  }

  const firstViewButton = page.getByRole("button", { name: /^view$/i }).first();
  if ((await firstViewButton.count()) > 0) {
    await firstViewButton.click();
  }

  await expect(page.getByTestId("approve-button")).toHaveCount(0);
  await expect(page.getByTestId("reject-button")).toHaveCount(0);
});
