import { z } from "zod";

// Shared between the browser (inline validation) and the server (authoritative validation).

export const TIMELINES = [
  { value: "asap", label: "As soon as possible" },
  { value: "within_3_months", label: "Within 3 months" },
  { value: "3_to_6_months", label: "3 to 6 months" },
  { value: "6_plus_months", label: "More than 6 months" },
  { value: "exploring", label: "Just exploring options" },
] as const;

export const BUDGETS = [
  { value: "under_25k", label: "Under 25,000" },
  { value: "25k_75k", label: "25,000 – 75,000" },
  { value: "75k_150k", label: "75,000 – 150,000" },
  { value: "150k_plus", label: "More than 150,000" },
  { value: "not_sure", label: "Not sure yet" },
] as const;

export const CONTACT_PREFERENCES = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
] as const;

export type FieldMode = "off" | "optional" | "required";

export interface EnquiryFormConfig {
  phone: FieldMode;
  country: FieldMode;
  timeline: FieldMode;
  budget: FieldMode;
  serviceSlugs: string[];
}

export const LIMITS = {
  name: 120,
  email: 254,
  organisation: 160,
  phone: 30,
  country: 80,
  summaryMin: 20,
  summaryMax: 5000,
} as const;

const clean = (s: string) =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
const singleLine = (s: string) => clean(s).replace(/\s+/g, " ");

function optionalField<T extends z.ZodTypeAny>(
  mode: FieldMode,
  schema: T,
  requiredMessage: string,
) {
  if (mode === "off")
    return z
      .any()
      .optional()
      .transform(() => null);
  const emptyToNull = z.preprocess(
    (v) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v),
    schema.nullable(),
  );
  if (mode === "optional") return emptyToNull.optional().transform((v) => v ?? null);
  return emptyToNull.refine((v) => v !== null && v !== undefined, requiredMessage);
}

export function buildEnquirySchema(cfg: EnquiryFormConfig) {
  return z.object({
    name: z
      .string({ error: "Enter your name." })
      .transform(singleLine)
      .pipe(
        z
          .string()
          .min(1, "Enter your name.")
          .max(LIMITS.name, `Use ${LIMITS.name} characters or fewer.`),
      ),
    email: z
      .string({ error: "Enter your work email address." })
      .transform((s) => clean(s))
      .pipe(
        z
          .string()
          .min(1, "Enter your work email address.")
          .max(LIMITS.email, "Email address is too long.")
          .pipe(z.email("Enter a valid email address, like name@company.com.")),
      ),
    organisation: z
      .string({ error: "Enter your organisation." })
      .transform(singleLine)
      .pipe(
        z
          .string()
          .min(1, "Enter your organisation.")
          .max(LIMITS.organisation, `Use ${LIMITS.organisation} characters or fewer.`),
      ),
    phone: optionalField(
      cfg.phone,
      z
        .string()
        .transform(singleLine)
        .pipe(
          z
            .string()
            .regex(
              /^\+?[0-9 ().-]{6,30}$/,
              "Enter a valid phone number, including country code if outside your region.",
            ),
        ),
      "Enter a phone number.",
    ),
    country: optionalField(
      cfg.country,
      z.string().transform(singleLine).pipe(z.string().max(LIMITS.country)),
      "Enter your country.",
    ),
    services: z
      .array(z.string())
      .default([])
      .transform((arr) => [...new Set(arr)])
      .pipe(
        z
          .array(
            z.enum(
              cfg.serviceSlugs.length ? (cfg.serviceSlugs as [string, ...string[]]) : ["__none__"],
              { error: "Select a listed service." },
            ),
          )
          .min(1, "Select at least one service you are interested in.")
          .max(10),
      ),
    projectSummary: z
      .string({ error: "Tell us about your project." })
      .transform(clean)
      .pipe(
        z
          .string()
          .min(
            LIMITS.summaryMin,
            `Tell us a little more (at least ${LIMITS.summaryMin} characters).`,
          )
          .max(LIMITS.summaryMax, `Use ${LIMITS.summaryMax} characters or fewer.`),
      ),
    timeline: optionalField(
      cfg.timeline,
      z.enum(TIMELINES.map((t) => t.value) as [string, ...string[]], {
        error: "Choose a timeline.",
      }),
      "Choose a timeline.",
    ),
    budgetRange: optionalField(
      cfg.budget,
      z.enum(BUDGETS.map((b) => b.value) as [string, ...string[]], {
        error: "Choose a budget range.",
      }),
      "Choose a budget range.",
    ),
    contactPreference: z.enum(["email", "phone"]).default("email"),
    privacyAcknowledged: z.literal(true, {
      error: "Confirm that you have read the privacy notice.",
    }),
  });
}

export type EnquiryInput = z.infer<ReturnType<typeof buildEnquirySchema>>;

/** Convert FormData (or a plain JSON body) into the shape the schema expects. */
export function enquiryRawFromFormData(fd: FormData): Record<string, unknown> {
  const str = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" ? v : undefined;
  };
  return {
    name: str("name"),
    email: str("email"),
    organisation: str("organisation"),
    phone: str("phone"),
    country: str("country"),
    services: fd.getAll("services").filter((v): v is string => typeof v === "string"),
    projectSummary: str("projectSummary"),
    timeline: str("timeline"),
    budgetRange: str("budgetRange"),
    contactPreference: str("contactPreference") || "email",
    privacyAcknowledged:
      str("privacyAcknowledged") === "on" || str("privacyAcknowledged") === "true",
  };
}

export const labelFor = (
  list: readonly { value: string; label: string }[],
  value: string | null | undefined,
) => list.find((i) => i.value === value)?.label ?? value ?? "";
