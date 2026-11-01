import { PrismaClient, type Role } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

/**
 * Bootstrap or recover an administrator account without the web UI.
 *
 *   npm run admin:create -- --email admin@example.com --name "Ada Admin" [--roles ADMIN,PUBLISHER]
 *   npm run admin:create -- --email admin@example.com --reset-mfa
 *
 * Prints a single-use setup link (valid 48 hours). No password is ever passed on the command line.
 */
const prisma = new PrismaClient();
const VALID: Role[] = ["ADMIN", "PUBLISHER", "EDITOR", "SALES", "SALES_MANAGER", "MARKETING"];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    throw new Error("Provide --email <address>");
  const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const roles = (arg("roles") ?? "ADMIN").split(",").map((r) => r.trim().toUpperCase()) as Role[];
  if (roles.some((r) => !VALID.includes(r)))
    throw new Error(`Roles must be from: ${VALID.join(", ")}`);

  let user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.adminUser.create({
      data: {
        email,
        displayName: arg("name") ?? email.split("@")[0]!,
        roles: { create: roles.map((role) => ({ role })) },
      },
    });
    console.log(`Created user ${email} with roles ${roles.join(", ")}.`);
  } else {
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { active: true, failedLogins: 0, lockedUntil: null },
    });
    for (const role of roles)
      await prisma.userRole.upsert({
        where: { userId_role: { userId: user.id, role } },
        create: { userId: user.id, role },
        update: {},
      });
    console.log(`User ${email} exists; ensured roles ${roles.join(", ")} and re-activated.`);
  }
  if (process.argv.includes("--reset-mfa")) {
    await prisma.adminUser.update({
      where: { id: user.id },
      data: { mfaSecretEnc: null, mfaEnabledAt: null, mfaLastUsedStep: null },
    });
    await prisma.session.deleteMany({ where: { userId: user.id } });
    console.log("MFA reset; the user will enrol again at next sign-in.");
  }
  const token = randomBytes(32).toString("base64url");
  await prisma.userSetupToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.userSetupToken.create({
    data: {
      userId: user.id,
      purpose: "reset",
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 48 * 3600_000),
    },
  });
  await prisma.auditEvent.create({
    data: {
      action: "user.cli_setup_link",
      entityType: "user",
      entityId: user.id,
      metadata: { roles },
    },
  });
  console.log(
    `\nSet the password within 48 hours using this single-use link:\n${siteUrl}/admin/setup?token=${encodeURIComponent(token)}\n`,
  );
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
