// Integration tests run against a dedicated PostgreSQL database (never the dev or production one).
const url =
  process.env.TEST_DATABASE_URL ?? "postgresql://app:app@127.0.0.1:5433/corpweb_test?schema=public";
process.env.DATABASE_URL = url;
process.env.SITE_URL = "https://example.test";
process.env.APP_SECRET = "integration-test-secret-0123456789-abcdefgh";
process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
process.env.EMAIL_PROVIDER = "console";
process.env.APP_ENV = "test";
process.env.OPS_ALERT_EMAIL = "ops@example.test";
process.env.TRUST_PROXY = "true";
