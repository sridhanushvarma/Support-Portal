import { PrismaClient, type Prisma } from "@prisma/client";
import { hashPassword } from "../../src/lib/auth/password";
import { encrypt } from "../../src/lib/crypto";
import { buildProjectSnapshot } from "../../src/lib/content/snapshots";
import { E2E_ADMIN } from "./constants";

const prisma = new PrismaClient();

async function main() {
  await prisma.adminUser.create({
    data: {
      email: E2E_ADMIN.email,
      displayName: "E2E Admin",
      passwordHash: await hashPassword(E2E_ADMIN.password),
      passwordChangedAt: new Date(Date.now() - 60_000),
      mfaSecretEnc: encrypt(E2E_ADMIN.totpSecret),
      mfaEnabledAt: new Date(),
      roles: {
        create: ["ADMIN", "PUBLISHER", "SALES_MANAGER"].map((role) => ({ role: role as "ADMIN" })),
      },
    },
  });
  const service = await prisma.service.findUniqueOrThrow({ where: { slug: "data-analytics-bi" } });
  const project = await prisma.project.create({
    data: {
      slug: "reporting-modernisation",
      title: "Reporting modernisation for a distributor",
      summary: "Automated management reporting replaced manual spreadsheet consolidation.",
      seoDescription: "Example anonymised case study used by automated tests.",
      content: {
        anonymisedLabel: "Regional distributor",
        challenge: "Reports were compiled by hand each month.",
        technologies: ["SQL", "Power BI"],
      },
      services: { create: [{ serviceId: service.id }] },
    },
  });
  const now = new Date();
  await prisma.project.update({
    where: { id: project.id },
    data: {
      status: "PUBLISHED",
      publishedSlug: project.slug,
      publishedAt: now,
      publishedServiceIds: [service.id],
      published: buildProjectSnapshot(project, new Map()) as unknown as Prisma.InputJsonValue,
    },
  });
  console.log("e2e fixtures ready");
}

main().finally(() => prisma.$disconnect());
