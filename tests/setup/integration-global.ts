import { execSync } from "node:child_process";

/**
 * Recreates the test schema and applies all migrations once per run. Refuses
 * to touch a database whose name does not contain "test".
 */
export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ??
    "postgresql://app:app@127.0.0.1:5433/corpweb_test?schema=public";
  const dbName = new URL(url).pathname.slice(1);
  if (!/test/i.test(dbName)) throw new Error(`Refusing to reset non-test database "${dbName}"`);
  const env = { ...process.env, DATABASE_URL: url };
  execSync(`npx prisma db execute --stdin --url "${url}"`, {
    input: "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;",
    env,
    stdio: ["pipe", "ignore", "inherit"],
  });
  execSync("npx prisma migrate deploy", { env, stdio: ["ignore", "ignore", "inherit"] });
}
