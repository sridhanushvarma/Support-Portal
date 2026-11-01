import { execSync } from "node:child_process";

/**
 * Resets the e2e database, applies migrations, loads starter content and
 * creates fixtures: an administrator with a known password and MFA secret,
 * and one published, anonymised project.
 */
export default async function globalSetup() {
  const url =
    process.env.E2E_DATABASE_URL ?? "postgresql://app:app@127.0.0.1:5433/corpweb_e2e?schema=public";
  if (!/e2e|test/i.test(new URL(url).pathname))
    throw new Error("Refusing to reset a non-test database");
  const env = {
    ...process.env,
    DATABASE_URL: url,
    APP_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123456789",
    APP_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64"),
    SITE_URL: "http://127.0.0.1:3100",
  };
  execSync(`npx prisma db execute --stdin --url "${url}"`, {
    input: "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;",
    env,
    stdio: ["pipe", "ignore", "inherit"],
  });
  execSync("npx prisma migrate deploy", { env, stdio: ["ignore", "ignore", "inherit"] });
  execSync("npx tsx prisma/seed.ts", { env, stdio: ["ignore", "ignore", "inherit"] });
  execSync("npx tsx tests/e2e/fixtures.ts", { env, stdio: ["ignore", "inherit", "inherit"] });
}
