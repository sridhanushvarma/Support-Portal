import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { permissionsFor } from "@/lib/auth/permissions";
import type { SessionUser } from "@/lib/auth/session";
import { saveService, transitionContent } from "@/lib/content/admin";
import { serviceContentSchema } from "@/lib/content/schemas";

export async function resetData() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(
    `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
}

let counter = 0;
export async function makeUser(roles: Role[], opts: { mfa?: boolean } = {}): Promise<SessionUser> {
  counter++;
  const u = await prisma.adminUser.create({
    data: {
      email: `user${counter}-${Date.now()}@example.test`,
      displayName: `User ${counter}`,
      mfaEnabledAt: opts.mfa ? new Date() : null,
      roles: { create: roles.map((role) => ({ role })) },
    },
  });
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    roles,
    permissions: permissionsFor(roles),
    mfaEnabled: Boolean(opts.mfa),
  };
}

export async function publishedService(publisher: SessionUser, slug: string, name: string) {
  const s = await saveService({ user: publisher }, null, {
    name,
    slug,
    sortOrder: 1,
    seoTitle: null,
    seoDescription: `${name} description`,
    content: serviceContentSchema.parse({
      headline: `${name} headline`,
      summary: `${name} summary`,
    }),
  });
  await transitionContent({ user: publisher }, "service", s!.id, "publish");
  return s!;
}

export function validEnquiry(overrides: Record<string, unknown> = {}) {
  return {
    name: "Jane Tester",
    email: "Jane@Example.com",
    organisation: "Example Org",
    services: ["erp-solutions"],
    projectSummary: "We would like to connect our finance and warehouse systems.",
    contactPreference: "email",
    privacyAcknowledged: true,
    ...overrides,
  };
}
