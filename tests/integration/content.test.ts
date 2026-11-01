import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  approveProjectEvidence,
  publishBlockers,
  saveProject,
  saveService,
  transitionContent,
  type ProjectInput,
} from "@/lib/content/admin";
import { projectContentSchema, serviceContentSchema } from "@/lib/content/schemas";
import {
  fetchPublishedProject,
  fetchPublishedProjects,
  fetchPublishedService,
  fetchPublishedServices,
  fetchRelatedProjects,
} from "@/lib/content/public-data";
import { resolveRedirect, upsertRedirect } from "@/lib/redirects";
import { makeUser, publishedService, resetData } from "./helpers";
import type { SessionUser } from "@/lib/auth/session";

let editor: SessionUser;
let publisher: SessionUser;
let serviceId: string;

beforeEach(async () => {
  await resetData();
  editor = await makeUser(["EDITOR"]);
  publisher = await makeUser(["PUBLISHER"]);
  serviceId = (await publishedService(publisher, "erp-solutions", "Enterprise ERP Solutions")).id;
});

function projectInput(
  overrides: Partial<ProjectInput> = {},
  content: Record<string, unknown> = {},
): ProjectInput {
  return {
    title: "Warehouse integration",
    slug: "warehouse-integration",
    summary: "Connected warehouse and finance systems.",
    featured: false,
    sortDate: new Date("2026-05-01"),
    clientPermission: "NOT_REQUIRED",
    thumbnailId: null,
    serviceIds: [serviceId],
    seoTitle: null,
    seoDescription: "Case study",
    content: projectContentSchema.parse({
      anonymisedLabel: "Regional distributor",
      challenge: "Manual re-keying.",
      ...content,
    }),
    ...overrides,
  };
}

describe("publication rules (BR-01, FR-ADM-006, UC-05)", () => {
  it("keeps drafts private and serves only the published snapshot", async () => {
    const draft = await saveService({ user: editor }, null, {
      name: "Draft service",
      slug: "draft-service",
      sortOrder: 2,
      seoTitle: null,
      seoDescription: "x",
      content: serviceContentSchema.parse({ headline: "Secret headline", summary: "Draft" }),
    });
    expect(await fetchPublishedService("draft-service")).toBeNull();
    expect((await fetchPublishedServices()).map((s) => s.slug)).toEqual(["erp-solutions"]);

    // Editing live content creates a draft revision; the public snapshot is unchanged.
    const live = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
    await saveService(
      { user: editor },
      serviceId,
      {
        name: live.name,
        slug: live.slug,
        sortOrder: 1,
        seoTitle: null,
        seoDescription: "x",
        content: serviceContentSchema.parse({
          headline: "Unapproved new headline",
          summary: "Changed",
        }),
      },
      live.updatedAt.toISOString(),
    );
    expect((await fetchPublishedService("erp-solutions"))!.content.headline).toBe(
      "Enterprise ERP Solutions headline",
    );
    expect((await prisma.service.findUniqueOrThrow({ where: { id: serviceId } })).status).toBe(
      "DRAFT",
    );

    await expect(
      transitionContent({ user: editor }, "service", draft!.id, "publish"),
    ).rejects.toMatchObject({ status: 403 });
    await transitionContent({ user: editor }, "service", draft!.id, "submit");
    await transitionContent({ user: publisher }, "service", draft!.id, "publish");
    expect((await fetchPublishedService("draft-service"))!.content.headline).toBe(
      "Secret headline",
    );

    await transitionContent({ user: publisher }, "service", draft!.id, "archive");
    expect(await fetchPublishedService("draft-service")).toBeNull();
  });

  it("detects concurrent edits", async () => {
    const live = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
    const input = {
      name: live.name,
      slug: live.slug,
      sortOrder: 1,
      seoTitle: null,
      seoDescription: "x",
      content: serviceContentSchema.parse({ headline: "A", summary: "B" }),
    };
    await saveService({ user: editor }, serviceId, input, live.updatedAt.toISOString());
    await expect(
      saveService({ user: editor }, serviceId, input, live.updatedAt.toISOString()),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("requires a reason to return content to the editor", async () => {
    const s = await saveService({ user: editor }, null, {
      name: "X",
      slug: "x-service",
      sortOrder: 3,
      seoTitle: null,
      seoDescription: "x",
      content: serviceContentSchema.parse({ headline: "H", summary: "S" }),
    });
    await transitionContent({ user: editor }, "service", s!.id, "submit");
    await expect(
      transitionContent({ user: publisher }, "service", s!.id, "reject"),
    ).rejects.toMatchObject({ status: 422 });
    await transitionContent(
      { user: publisher },
      "service",
      s!.id,
      "reject",
      "Please check the claims",
    );
    expect((await prisma.service.findUniqueOrThrow({ where: { id: s!.id } })).reviewNote).toBe(
      "Please check the claims",
    );
  });

  it("blocks unsupported verified claims on services (FR-SRV-005)", async () => {
    const s = await saveService({ user: editor }, null, {
      name: "Claims",
      slug: "claims",
      sortOrder: 4,
      seoTitle: null,
      seoDescription: "x",
      content: serviceContentSchema.parse({
        headline: "H",
        summary: "S",
        outcomes: [{ text: "50% cost cut", evidence: "verified" }],
      }),
    });
    expect(await publishBlockers("service", s!.id)).toEqual([
      expect.stringMatching(/verified but has no evidence note/),
    ]);
    await expect(
      transitionContent({ user: publisher }, "service", s!.id, "publish"),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe("case-study evidence gate (FR-PORT-004, BR-07, UAT-07)", () => {
  it("refuses to publish client evidence without permission and approval", async () => {
    const p = await saveProject(
      { user: editor },
      null,
      projectInput(
        { clientPermission: "PENDING" },
        { clientName: "Acme Ltd", outcomes: [{ label: "Close time", value: "-3 days" }] },
      ),
    );
    const blockers = await publishBlockers("project", p!.id);
    expect(blockers.join(" ")).toMatch(/permission is not recorded as Granted/);
    expect(blockers.join(" ")).toMatch(/evidence approval/);
    await expect(
      transitionContent({ user: publisher }, "project", p!.id, "publish"),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      approveProjectEvidence({ user: publisher }, p!.id, "Checked"),
    ).rejects.toMatchObject({ status: 422 });

    const cur = await prisma.project.findUniqueOrThrow({ where: { id: p!.id } });
    await saveProject(
      { user: editor },
      p!.id,
      projectInput(
        { clientPermission: "GRANTED" },
        { clientName: "Acme Ltd", outcomes: [{ label: "Close time", value: "-3 days" }] },
      ),
      cur.updatedAt.toISOString(),
    );
    await expect(approveProjectEvidence({ user: editor }, p!.id, "Checked")).rejects.toMatchObject({
      status: 403,
    });
    await approveProjectEvidence({ user: publisher }, p!.id, "Signed permission letter on file");
    await transitionContent({ user: publisher }, "project", p!.id, "publish");
    expect((await fetchPublishedProject("warehouse-integration"))!.displayClient).toBe("Acme Ltd");

    // Changing evidence afterwards clears the approval so the next publish needs a fresh check.
    const after = await prisma.project.findUniqueOrThrow({ where: { id: p!.id } });
    await saveProject(
      { user: editor },
      p!.id,
      projectInput(
        { clientPermission: "GRANTED" },
        { clientName: "Acme Ltd", outcomes: [{ label: "Close time", value: "-10 days" }] },
      ),
      after.updatedAt.toISOString(),
    );
    expect(
      (await prisma.project.findUniqueOrThrow({ where: { id: p!.id } })).evidenceApprovedAt,
    ).toBeNull();
    expect((await fetchPublishedProject("warehouse-integration"))!.content.outcomes[0]!.value).toBe(
      "-3 days",
    );
  });

  it("publishes anonymised projects without client evidence and supports service filters", async () => {
    const p = await saveProject({ user: editor }, null, projectInput());
    await transitionContent({ user: publisher }, "project", p!.id, "publish");
    const list = await fetchPublishedProjects({ serviceSlug: "erp-solutions" });
    expect(list.total).toBe(1);
    expect(list.items[0]!.displayClient).toBe("Regional distributor");
    expect(list.items[0]!.services).toEqual([
      { slug: "erp-solutions", name: "Enterprise ERP Solutions" },
    ]);
    expect((await fetchPublishedProjects({ serviceSlug: "unknown" })).total).toBe(0);
    expect(await fetchRelatedProjects(serviceId)).toHaveLength(1);
  });
});

describe("URL changes and redirects (UC-10, FR-PORT-006, UAT-08)", () => {
  it("creates a permanent redirect when a published slug changes and flattens chains", async () => {
    const p = await saveProject({ user: editor }, null, projectInput());
    await transitionContent({ user: publisher }, "project", p!.id, "publish");
    for (const slug of ["warehouse-integration-v2", "warehouse-integration-v3"]) {
      const cur = await prisma.project.findUniqueOrThrow({ where: { id: p!.id } });
      await saveProject(
        { user: editor },
        p!.id,
        projectInput({ slug }),
        cur.updatedAt.toISOString(),
      );
      await transitionContent({ user: publisher }, "project", p!.id, "publish");
    }
    expect(await resolveRedirect("/projects/warehouse-integration")).toEqual({
      targetPath: "/projects/warehouse-integration-v3",
      statusCode: 308,
    });
    expect(await resolveRedirect("/projects/warehouse-integration-v2")).toEqual({
      targetPath: "/projects/warehouse-integration-v3",
      statusCode: 308,
    });
    expect(await fetchPublishedProject("warehouse-integration")).toBeNull();
    expect(await fetchPublishedProject("warehouse-integration-v3")).not.toBeNull();

    // Moving back to an old slug removes the redirect that would otherwise loop.
    const cur = await prisma.project.findUniqueOrThrow({ where: { id: p!.id } });
    await saveProject(
      { user: editor },
      p!.id,
      projectInput({ slug: "warehouse-integration" }),
      cur.updatedAt.toISOString(),
    );
    await transitionContent({ user: publisher }, "project", p!.id, "publish");
    expect(await resolveRedirect("/projects/warehouse-integration")).toBeNull();
    expect((await resolveRedirect("/projects/warehouse-integration-v3"))!.targetPath).toBe(
      "/projects/warehouse-integration",
    );
  });

  it("rejects redirect loops", async () => {
    await upsertRedirect(prisma, { sourcePath: "/a", targetPath: "/b" });
    await upsertRedirect(prisma, { sourcePath: "/b", targetPath: "/c" });
    expect(
      (await prisma.redirect.findUniqueOrThrow({ where: { sourcePath: "/a" } })).targetPath,
    ).toBe("/c");
    await expect(
      upsertRedirect(prisma, { sourcePath: "/c", targetPath: "/a" }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("rejects duplicate slugs at the data layer (BR-02)", async () => {
    await saveProject({ user: editor }, null, projectInput());
    await expect(saveProject({ user: editor }, null, projectInput())).rejects.toMatchObject({
      status: 422,
      fieldErrors: { slug: expect.any(Array) },
    });
  });
});
