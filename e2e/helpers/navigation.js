const { expect } = require("@playwright/test");

const moduleRoutes = {
  "dashboard": "/dashboard-1",
  "overview 1": "/dashboard-1",
  "user admin": "/users",
  "users": "/users",
  "role permissions": "/permissions/roles",
  "role permission setup": "/permissions/roles",
  "employee master": "/employees",
  "checklist master": "/checklists",
  "checklist create": "/checklists/create",
  "checklist approval": "/checklists/admin-approvals",
  "admin approvals": "/checklists/admin-approvals",
  "poll master": "/polls",
  "polling system": "/polls",
  "attendance": "/attendance",
  "complaints": "/complaints",
};

function normalizeModuleName(moduleName) {
  return String(moduleName || "").trim().toLowerCase();
}

async function isAccessDenied(page) {
  const bodyText = await page.locator("body").innerText().catch(() => "");
  return /access denied|do not have access|do not currently have permission/i.test(bodyText);
}

async function isLoginPage(page) {
  const url = new URL(page.url());
  return url.pathname.includes("/login");
}

async function gotoModule(page, moduleName) {
  const route = moduleRoutes[normalizeModuleName(moduleName)];

  if (route) {
    await page.goto(route);
    return;
  }

  await safeClickByText(page, moduleName);
}

async function expectPageReady(page, titleOrText) {
  await expect(page.locator("body")).toContainText(titleOrText);
}

async function safeClickByText(page, text) {
  const escapedText = String(text || "").trim();
  const candidates = [
    page.getByRole("link", { name: new RegExp(escapedText, "i") }),
    page.getByRole("button", { name: new RegExp(escapedText, "i") }),
    page.getByText(new RegExp(escapedText, "i")),
  ];

  for (const locator of candidates) {
    if ((await locator.count()) > 0) {
      await locator.first().click();
      return true;
    }
  }

  return false;
}

module.exports = {
  gotoModule,
  expectPageReady,
  safeClickByText,
  isAccessDenied,
  isLoginPage,
};
