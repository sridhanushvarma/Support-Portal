import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
    SITE_URL: z.url().transform((v) => v.replace(/\/+$/, "")),
    SITE_INDEXABLE: bool,
    DATABASE_URL: z.string().min(1),
    APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters"),
    APP_ENCRYPTION_KEY: z
      .string()
      .refine(
        (v) => Buffer.from(v, "base64").length === 32,
        "APP_ENCRYPTION_KEY must be 32 bytes, base64",
      ),
    TRUST_PROXY: bool,
    ADMIN_MFA_REQUIRED: bool,
    SESSION_IDLE_MINUTES: z.coerce
      .number()
      .int()
      .min(5)
      .max(24 * 60)
      .default(30),
    SESSION_MAX_HOURS: z.coerce
      .number()
      .int()
      .min(1)
      .max(24 * 7)
      .default(12),
    EMAIL_PROVIDER: z.enum(["console", "smtp", "disabled"]).default("console"),
    EMAIL_FROM: z.string().min(3).default("Website <no-reply@example.com>"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_SECURE: bool,
    OPS_ALERT_EMAIL: z.union([z.email(), z.literal("")]).optional(),
    MEDIA_STORAGE_DIR: z.string().default("./storage/media"),
    CRON_SECRET: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_PROVIDER === "smtp" && !env.SMTP_HOST) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_HOST"],
        message: "SMTP_HOST is required when EMAIL_PROVIDER=smtp",
      });
    }
    if (env.APP_ENV === "production") {
      if (env.EMAIL_PROVIDER === "console") {
        ctx.addIssue({
          code: "custom",
          path: ["EMAIL_PROVIDER"],
          message: "console email provider is not allowed in production",
        });
      }
      if (!env.SITE_URL.startsWith("https://")) {
        ctx.addIssue({
          code: "custom",
          path: ["SITE_URL"],
          message: "SITE_URL must use https in production",
        });
      }
      if (env.APP_SECRET.startsWith("change-me")) {
        ctx.addIssue({
          code: "custom",
          path: ["APP_SECRET"],
          message: "APP_SECRET still has the example value",
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Validated server environment. Parsed lazily so that `next build` does not
 * require runtime secrets; the first request fails fast if configuration is invalid.
 */
export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** For tests only. */
export function resetEnvCache() {
  cached = null;
}

export const isProductionEnv = () => env().APP_ENV === "production";
