const { expect } = require("@playwright/test");

const PLACEHOLDER_EMAILS = new Set(["admin@example.com", "employee@example.com"]);
const PLACEHOLDER_PASSWORD = "change-me";

function hasCredentials(email, password) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return Boolean(
    normalizedEmail &&
      password &&
      !PLACEHOLDER_EMAILS.has(normalizedEmail) &&
      password !== PLACEHOLDER_PASSWORD
  );
}

async function firstAvailableLocator(candidates) {
  for (const locator of candidates) {
    if ((await locator.count()) > 0) {
      return locator.first();
    }
  }

  throw new Error("No matching locator found");
}

async function maybeClickWelcomeSkip(page) {
  const skipButton = page.getByRole("button", { name: /^skip$/i });
  if (await skipButton.isVisible({ timeout: 2500 }).catch(() => false)) {
    await skipButton.click();
    return;
  }

  const continueButton = page.getByRole("button", { name: /^continue$/i });
  if (await continueButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await continueButton.click();
  }
}

async function login(page, email, password) {
  if (!hasCredentials(email, password)) {
    throw new Error("Missing E2E credentials. Add them to e2e/.env or your shell environment.");
  }

  await page.goto("/login");

  const loginIdInput = await firstAvailableLocator([
    page.getByLabel(/email|login id|employee code/i),
    page.getByTestId("login-email"),
    page.locator('input[type="email"]'),
    page.locator('input[name="email"]'),
    page.locator('input[name="loginId"]'),
    page.locator('input[type="text"]').first(),
  ]);
  await loginIdInput.fill(email);

  const passwordInput = await firstAvailableLocator([
    page.getByLabel(/password/i),
    page.getByTestId("login-password"),
    page.locator('input[type="password"]'),
  ]);
  await passwordInput.fill(password);

  const submitButton = await firstAvailableLocator([
    page.getByRole("button", { name: /login|sign in/i }),
    page.getByTestId("login-submit"),
    page.locator(".login-submit"),
  ]);
  await submitButton.click();

  await expect
    .poll(
      async () => {
        const loginError = await page
          .getByTestId("login-error")
          .innerText({ timeout: 250 })
          .catch(() => "");

        if (loginError) {
          return `login-error:${loginError}`;
        }

        return new URL(page.url()).pathname;
      },
      { timeout: 15000 }
    )
    .not.toMatch(/^\/login$|^login-error:/);

  await maybeClickWelcomeSkip(page);
  await expectLoggedIn(page);
}

async function logout(page) {
  const logoutButton = await firstAvailableLocator([
    page.getByTestId("logout-button"),
    page.getByRole("button", { name: /logout|log out|sign out/i }),
    page.locator(".app-navbar button").filter({ hasText: /logout/i }),
  ]);

  await logoutButton.click();
  await expect(page).toHaveURL(/\/login/);
}

async function expectLoggedIn(page) {
  const appShell = page.locator('[data-testid="app-navbar"], .app-navbar');
  await expect(appShell.first()).toBeVisible();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

async function expectAccessDeniedOrRedirect(page) {
  await expect
    .poll(
      async () => {
        const url = new URL(page.url());
        const bodyText = await page.locator("body").innerText().catch(() => "");
        return `${url.pathname} ${bodyText}`;
      },
      { timeout: 10000 }
    )
    .toMatch(/\/login|\/access-denied|access denied|do not.*permission/i);
}

module.exports = {
  hasCredentials,
  login,
  logout,
  expectLoggedIn,
  expectAccessDeniedOrRedirect,
};
