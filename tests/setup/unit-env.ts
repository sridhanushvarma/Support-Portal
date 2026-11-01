// Deterministic configuration for unit tests (no database access).
process.env.SITE_URL = "https://example.test";
process.env.APP_SECRET = "unit-test-secret-unit-test-secret-0123456789";
process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.DATABASE_URL ??= "postgresql://unused:unused@127.0.0.1:1/unused";
process.env.EMAIL_PROVIDER = "console";
process.env.APP_ENV = "test";
