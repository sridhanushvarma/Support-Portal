import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { currentStep, totpAt } from "../../src/lib/auth/totp";
import { E2E_ADMIN } from "./constants";

/** Automated WCAG 2.2 A/AA scan; fails on serious or critical violations (NFR-06). */
export async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious.map(
      (v) =>
        `${v.id}: ${v.help} (${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(", ")})`,
    ),
  ).toEqual([]);
}

let lastStep = 0;
/** Signs in as the fixture administrator, waiting for a fresh TOTP step if needed (codes are single-use). */
export async function adminLogin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin\/login\/verify/);
  while (currentStep() <= lastStep) await page.waitForTimeout(1000);
  lastStep = currentStep();
  await page.getByLabel("Verification code").fill(totpAt(E2E_ADMIN.totpSecret, lastStep));
  await page.getByRole("button", { name: "Verify" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/admin/login"));
}

export async function waitForFormReady(page: Page) {
  // The signed form token enforces a minimum completion time before submission.
  await page.waitForTimeout(2700);
}
