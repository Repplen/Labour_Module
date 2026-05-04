const { test, expect } = require("@playwright/test");
const { hasCredentials, login } = require("./helpers/auth");
const { gotoModule, isAccessDenied } = require("./helpers/navigation");
const { getFutureDate, getTodayDate } = require("./helpers/testData");

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const employeeEmail = process.env.E2E_EMPLOYEE_EMAIL;
const employeePassword = process.env.E2E_EMPLOYEE_PASSWORD;

async function loginAsAdmin(page) {
  test.skip(!hasCredentials(adminEmail, adminPassword), "Set admin E2E credentials.");
  await login(page, adminEmail, adminPassword);
}

async function openPollMaster(page) {
  await loginAsAdmin(page);
  await gotoModule(page, "poll master");
  test.skip(await isAccessDenied(page), "Admin user does not currently have Poll Master access.");
}

async function openPollCreate(page) {
  await loginAsAdmin(page);
  await page.goto("/polls/create");
  test.skip(await isAccessDenied(page), "Create Poll permission is not available.");
}

test("Admin can open Poll Master", async ({ page }) => {
  await openPollMaster(page);
  await expect(page.getByTestId("poll-master-page")).toBeVisible();
});

test("Poll list loads", async ({ page }) => {
  await openPollMaster(page);
  await expect(page.getByTestId("poll-table")).toBeVisible();
});

test("Create Poll page/form opens", async ({ page }) => {
  await openPollMaster(page);

  const addPollButton = page.getByTestId("add-poll-button");
  test.skip((await addPollButton.count()) === 0, "Create Poll permission is not available.");

  await addPollButton.click();
  await expect(page.getByTestId("poll-create-page")).toBeVisible();
});

test("Start Date, Start Time, End Date, End Time fields are visible", async ({ page }) => {
  await openPollCreate(page);

  await expect(page.getByTestId("poll-start-date")).toBeVisible();
  await expect(page.getByTestId("poll-start-time")).toBeVisible();
  await expect(page.getByTestId("poll-end-date")).toBeVisible();
  await expect(page.getByTestId("poll-end-time")).toBeVisible();
});

test("Empty submit shows validation", async ({ page }) => {
  await openPollCreate(page);

  await page.getByTestId("save-poll-button").click();
  await expect(page.locator("body")).toContainText(/Enter poll title/i);
});

test("End Date Time before Start Date Time shows validation", async ({ page }) => {
  await openPollCreate(page);

  const selectShown = page.getByRole("button", { name: /select shown/i }).first();
  test.skip(
    (await selectShown.count()) === 0 || (await selectShown.isDisabled()),
    "No poll scope options are available for validation flow."
  );

  await page.getByPlaceholder(/enter poll title/i).fill("E2E Validation Poll");
  await selectShown.click();
  await page.getByTestId("poll-start-date").fill(getFutureDate(1));
  await page.getByTestId("poll-start-time").fill("10:00");
  await page.getByTestId("poll-end-date").fill(getTodayDate());
  await page.getByTestId("poll-end-time").fill("09:00");
  await page.getByTestId("save-poll-button").click();

  await expect(page.locator("body")).toContainText(
    /End date time must be greater than start date time/i
  );
});

test("Assigned Poll page disables submit for upcoming/expired polls if test data exists", async ({
  page,
}) => {
  test.skip(
    !hasCredentials(employeeEmail, employeePassword),
    "Set employee E2E credentials to test assigned polls."
  );

  await login(page, employeeEmail, employeePassword);
  await page.goto("/polls");
  test.skip(await isAccessDenied(page), "Employee user does not currently have assigned poll access.");

  const bodyText = await page.locator("body").innerText();
  test.skip(!/Upcoming|Expired/i.test(bodyText), "No upcoming or expired assigned polls exist.");

  const viewButton = page.getByRole("link", { name: /view|open/i }).first();
  await viewButton.click();
  await expect(page.getByRole("button", { name: /submit response/i })).toBeDisabled();
});
