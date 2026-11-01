import { expect, test } from "@playwright/test";
import { adminLogin, expectNoSeriousA11yViolations, waitForFormReady } from "./helpers";

test.describe.configure({ mode: "serial" });

let reference = "";

test("validation errors are explained and nothing is sent (UAT-03, FR-ENQ-003)", async ({
  page,
}) => {
  await page.goto("/contact");
  await page.getByRole("button", { name: "Discuss a project" }).click();
  const summary = page.locator("#main").getByRole("alert");
  await expect(summary).toContainText("There is a problem");
  await expect(summary).toBeFocused();
  await expect(summary.getByRole("link", { name: "Enter your name." })).toBeVisible();
  await expect(page.getByLabel("Your name")).toHaveAttribute("aria-invalid", "true");
  await summary.getByRole("link", { name: "Enter your work email address." }).click();
  await expect(page.getByLabel("Work email")).toBeFocused();
  await expectNoSeriousA11yViolations(page);
});

test("keyboard-only visitor can submit an enquiry with two services (UAT-04, UAT-09)", async ({
  page,
}) => {
  const events: string[] = [];
  await page.exposeFunction("recordEvent", (e: string) => events.push(e));
  await page.addInitScript(() =>
    window.addEventListener("cw:analytics", (e) =>
      (window as unknown as { recordEvent: (x: string) => void }).recordEvent(
        JSON.stringify((e as CustomEvent).detail),
      ),
    ),
  );
  await page.goto("/contact?service=ai-automation");
  await page.getByLabel("Your name").focus();
  await page.keyboard.type("Kim Keyboard");
  await page.keyboard.press("Tab");
  await page.keyboard.type("kim@example.com");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Keyboard Industries");
  await page.getByRole("checkbox", { name: "Custom Software Development" }).focus();
  await page.keyboard.press("Space");
  await page.getByLabel("Project summary").focus();
  await page.keyboard.type(
    "We want to automate invoice processing and build an internal approvals tool.",
  );
  await page.getByRole("checkbox", { name: /I have read the privacy notice/ }).focus();
  await page.keyboard.press("Space");
  await waitForFormReady(page);
  await page.getByRole("button", { name: "Discuss a project" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/thank-you\?ref=ENQ-/);
  reference = new URL(page.url()).searchParams.get("ref")!;
  await expect(page.getByText(reference)).toBeVisible();
  await expect(page.getByText(/confirms receipt only/)).toBeVisible();
  // Conversion events carry no personal data (BR-12).
  expect(events.join(" ")).toContain("enquiry_submitted");
  expect(events.join(" ")).not.toMatch(/kim|Keyboard Industries|invoice/i);
});

test("admin area requires authentication (FR-ADM-001, UAT-06)", async ({ page, request }) => {
  const res = await page.goto("/admin/enquiries");
  expect(new URL(page.url()).pathname).toBe("/admin/login");
  expect(res?.status()).toBe(200);
  expect((await request.get("/api/v1/admin/enquiries")).status()).toBe(401);
  expect(
    (
      await request.patch("/api/v1/admin/enquiries/00000000-0000-4000-8000-000000000000", {
        data: { status: "WON", version: 1 },
        headers: { origin: "https://evil.example" },
      })
    ).status(),
  ).toBe(403);
});

test("staff sign in with MFA and triage the enquiry (UC-04)", async ({ page }) => {
  await adminLogin(page);
  await page.goto("/admin/enquiries");
  await page.getByRole("link", { name: reference }).click();
  await page.waitForURL(/\/admin\/enquiries\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: reference })).toBeVisible();
  await expect(page.getByText("Keyboard Industries")).toBeVisible();
  await expect(
    page
      .getByText("Custom Software Development, AI and Intelligent Automation")
      .or(page.getByText("AI and Intelligent Automation, Custom Software Development")),
  ).toBeVisible();
  await page.getByLabel("Status").selectOption("QUALIFIED");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Enquiry updated." })).toBeVisible();
  await page.getByLabel("Add an internal note").fill("Booked an intro call for Tuesday.");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Booked an intro call for Tuesday.")).toBeVisible();
  await expect(page.locator("text=Status changed from New to Qualified")).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});

test("publisher edits are not public until published, and slug changes redirect (UC-05, UAT-08)", async ({
  page,
}) => {
  await adminLogin(page);
  await page.goto("/admin/pages");
  await page.getByRole("link", { name: "Our approach" }).click();
  await page.getByLabel("Main heading").fill("A delivery approach you can rely on");
  await page.getByLabel("URL slug").fill("how-we-work");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  const publicPage = await page.context().newPage();
  await publicPage.goto("/approach");
  await expect(publicPage.getByRole("heading", { level: 1 })).not.toHaveText(
    "A delivery approach you can rely on",
  );

  await page.reload();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("Published. The public site now shows this version.")).toBeVisible();

  const res = await publicPage.goto("/approach");
  expect(new URL(publicPage.url()).pathname).toBe("/how-we-work");
  expect(res?.status()).toBe(200);
  await expect(publicPage.getByRole("heading", { level: 1 })).toHaveText(
    "A delivery approach you can rely on",
  );
});
