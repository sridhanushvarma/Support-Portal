import { expect, test } from "@playwright/test";
import { expectNoSeriousA11yViolations } from "./helpers";

test.describe("public site journeys", () => {
  test("home presents services and leads to a service page and enquiry (UC-01, UAT-01)", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Main" });
    await nav.getByRole("link", { name: "Services" }).click();
    await expect(page).toHaveURL(/\/services$/);
    const main = page.locator("#main");
    for (const name of [
      "Enterprise ERP Solutions",
      "Custom Software Development",
      "Website and Web Application Development",
      "Data Analytics and Business Intelligence",
      "AI and Intelligent Automation",
    ]) {
      await expect(main.getByRole("link", { name })).toBeVisible();
    }
    await main.getByRole("link", { name: "Enterprise ERP Solutions" }).click();
    await expect(page).toHaveURL(/\/services\/erp-solutions$/);
    await expect(page.getByRole("heading", { name: "Problems we help solve" })).toBeVisible();
    await page.getByRole("link", { name: "Discuss your ERP project" }).first().click();
    await expect(page).toHaveURL(/\/contact\?service=erp-solutions/);
    await expect(page.getByRole("checkbox", { name: "Enterprise ERP Solutions" })).toBeChecked();
  });

  test("portfolio filters and reset (UC-02, UAT-02)", async ({ page }) => {
    await page.goto("/projects");
    const main = page.locator("#main");
    await expect(main.getByRole("status")).toHaveText(/1 project/);
    await main.getByRole("link", { name: "Enterprise ERP Solutions" }).click();
    await expect(page.getByText("No projects match this filter yet")).toBeVisible();
    await page.getByRole("link", { name: "Clear filter" }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await main.getByRole("link", { name: "Data Analytics and Business Intelligence" }).click();
    await expect(page).toHaveURL(/service=data-analytics-bi/);
    await main.getByRole("link", { name: /Reporting modernisation/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Reporting modernisation/);
    await expect(page.getByText("Regional distributor")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Context" })).toHaveCount(0); // empty sections are hidden
  });

  test("unknown pages return a helpful 404 (URS-022)", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "We could not find that page" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Services" }).first()).toBeVisible();
  });

  test("core routes have no serious accessibility violations (NFR-06)", async ({ page }) => {
    for (const path of [
      "/",
      "/services",
      "/services/ai-automation",
      "/projects",
      "/projects/reporting-modernisation",
      "/about",
      "/contact",
      "/privacy",
    ]) {
      await page.goto(path);
      await expectNoSeriousA11yViolations(page);
    }
  });

  test("SEO essentials are present (FR-SEO-001/002)", async ({ page, request }) => {
    await page.goto("/services/erp-solutions");
    await expect(page).toHaveTitle(/ERP/);
    expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toMatch(
      /\/services\/erp-solutions$/,
    );
    expect(await page.locator('meta[property="og:title"]').getAttribute("content")).toBeTruthy();
    expect(await page.locator('meta[name="description"]').getAttribute("content")).toBeTruthy();
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/services/erp-solutions");
    expect(sitemap).toContain("/projects/reporting-modernisation");
    expect(sitemap).not.toContain("/admin");
    expect(sitemap).not.toContain("/thank-you");
    expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /"); // non-production is never indexable
  });

  test("security headers are sent (NFR-08/09)", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-request-id"]).toBeTruthy();
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("public APIs return only published content", async ({ request }) => {
    const services = await (await request.get("/api/v1/services")).json();
    expect(services.data).toHaveLength(5);
    const projects = await (await request.get("/api/v1/projects?service=data-analytics-bi")).json();
    expect(projects.meta.total).toBe(1);
    expect((await request.get("/api/v1/projects/not-published")).status()).toBe(404);
    expect((await request.get("/api/health?ready=1")).status()).toBe(200);
  });
});
