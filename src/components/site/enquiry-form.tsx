"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { submitEnquiryAction, type EnquiryFormState } from "@/app/(public)/contact/actions";
import { track } from "@/lib/analytics/client";
import {
  BUDGETS,
  buildEnquirySchema,
  CONTACT_PREFERENCES,
  enquiryRawFromFormData,
  LIMITS,
  TIMELINES,
  type EnquiryFormConfig,
  type FieldMode,
} from "@/lib/enquiries/schema";

type Errors = Record<string, string[] | undefined>;

const FIELD_ORDER = [
  "name",
  "email",
  "organisation",
  "phone",
  "country",
  "services",
  "projectSummary",
  "timeline",
  "budgetRange",
  "contactPreference",
  "privacyAcknowledged",
];
const FIELD_IDS: Record<string, string> = {
  services: "field-services-legend",
  privacyAcknowledged: "field-privacyAcknowledged",
};
const fieldId = (name: string) => FIELD_IDS[name] ?? `field-${name}`;

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

export function EnquiryForm({
  services,
  config,
  preselected,
  initialToken,
  submitLabel,
}: {
  services: { slug: string; name: string }[];
  config: EnquiryFormConfig;
  preselected: string | null;
  initialToken: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<EnquiryFormState, FormData>(
    submitEnquiryAction,
    { status: "idle", formToken: initialToken },
  );
  const [clientErrors, setClientErrors] = useState<Errors | null>(null);
  const [summaryLength, setSummaryLength] = useState(0);
  const [hidden, setHidden] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const schema = useMemo(() => buildEnquirySchema(config), [config]);

  const errors: Errors = clientErrors ?? state.fieldErrors ?? {};
  const errorList = FIELD_ORDER.filter((f) => errors[f]?.length).map((f) => ({
    field: f,
    message: errors[f]![0]!,
  }));

  // Server-side errors replace client ones and move focus to the summary.
  useEffect(() => {
    if (state.status === "error") {
      setClientErrors(null);
      summaryRef.current?.focus();
    }
  }, [state]);

  // Attribution context (no personal data): where the visitor came from and campaign tags.
  useEffect(() => {
    const values: Record<string, string> = {};
    try {
      if (document.referrer) {
        const ref = new URL(document.referrer);
        if (ref.origin === location.origin) values.sourcePath = ref.pathname.slice(0, 300);
        else values.referrerHost = ref.hostname.slice(0, 253);
      }
      const stored = sessionStorage.getItem("cw_utm");
      const utm = stored ? (JSON.parse(stored) as Record<string, string>) : {};
      const params = new URLSearchParams(location.search);
      for (const k of UTM_KEYS) {
        const v = params.get(k) ?? utm[k];
        if (v) values[k] = v.slice(0, 150);
      }
    } catch {
      /* storage unavailable: attribution is optional */
    }
    if (preselected) values.sourceService = preselected;
    setHidden(values);
  }, [preselected]);

  function validate(fd: FormData): Errors {
    const result = schema.safeParse(enquiryRawFromFormData(fd));
    if (result.success) return {};
    const out: Errors = {};
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (out[key] ??= []).push(issue.message);
    }
    return out;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const found = validate(fd);
    if (Object.keys(found).length > 0) {
      setClientErrors(found);
      track("enquiry_validation_error", { fields: Object.keys(found).join(",") });
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }
    setClientErrors({});
    startTransition(() => formAction(fd));
  }

  function onBlur(e: React.FocusEvent<HTMLFormElement>) {
    const name = (e.target as unknown as HTMLInputElement).name;
    if (!name || !errors[name] || !formRef.current) return;
    // Re-check a field that is currently in error so the message clears as soon as it is fixed.
    const found = validate(new FormData(formRef.current));
    setClientErrors({ ...errors, [name]: found[name] });
  }

  function onFirstInteraction() {
    if (started.current) return;
    started.current = true;
    track("enquiry_form_start");
  }

  const show = (mode: FieldMode) => mode !== "off";
  const describedBy = (name: string, hint?: boolean) =>
    [hint ? `${fieldId(name)}-hint` : null, errors[name]?.length ? `${fieldId(name)}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={onSubmit}
      onBlur={onBlur}
      onFocus={onFirstInteraction}
      noValidate
      className="space-y-7"
      aria-describedby="form-intro"
    >
      <p id="form-intro" className="text-sm text-muted">
        Fields marked <span aria-hidden="true">*</span>
        <span className="sr-only">with an asterisk</span> are required.
      </p>

      {(errorList.length > 0 || state.message) && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border-2 border-danger bg-danger-soft p-5 focus:outline-none"
        >
          <h2 className="font-semibold text-danger">
            {errorList.length > 0 ? "There is a problem" : "Your enquiry was not sent"}
          </h2>
          {state.message && errorList.length === 0 && (
            <p className="mt-2 text-ink">{state.message}</p>
          )}
          {errorList.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {errorList.map((e) => (
                <li key={e.field}>
                  <a href={`#${fieldId(e.field)}`} className="text-danger underline">
                    {e.message}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <input type="hidden" name="formToken" value={state.formToken} />
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {/* Honeypot: hidden from people and assistive technology; bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="field-website">Website</label>
        <input id="field-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          name="name"
          label="Your name"
          required
          autoComplete="name"
          maxLength={LIMITS.name}
          error={errors.name}
          describedBy={describedBy("name")}
        />
        <TextField
          name="email"
          label="Work email"
          type="email"
          required
          autoComplete="email"
          maxLength={LIMITS.email}
          error={errors.email}
          describedBy={describedBy("email")}
        />
        <TextField
          name="organisation"
          label="Organisation"
          required
          autoComplete="organization"
          maxLength={LIMITS.organisation}
          error={errors.organisation}
          describedBy={describedBy("organisation")}
        />
        {show(config.phone) && (
          <TextField
            name="phone"
            label="Phone"
            type="tel"
            required={config.phone === "required"}
            autoComplete="tel"
            maxLength={LIMITS.phone}
            error={errors.phone}
            describedBy={describedBy("phone")}
          />
        )}
        {show(config.country) && (
          <TextField
            name="country"
            label="Country"
            required={config.country === "required"}
            autoComplete="country-name"
            maxLength={LIMITS.country}
            error={errors.country}
            describedBy={describedBy("country")}
          />
        )}
      </div>

      <fieldset aria-describedby={describedBy("services", true)}>
        <legend id="field-services-legend" tabIndex={-1} className="field-label">
          Which services are you interested in? <Req />
        </legend>
        <p id="field-services-legend-hint" className="field-hint -mt-1 mb-3">
          Select all that apply.
        </p>
        {errors.services?.length ? (
          <p id="field-services-legend-error" className="field-error mb-3">
            {errors.services[0]}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => (
            <label
              key={s.slug}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line px-4 py-2.5 hover:border-ink-soft has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
            >
              <input
                type="checkbox"
                name="services"
                value={s.slug}
                defaultChecked={s.slug === preselected}
                className="h-5 w-5 accent-[var(--color-brand)]"
              />
              <span className="text-ink">{s.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="field-projectSummary" className="field-label">
          Project summary <Req />
        </label>
        <p id="field-projectSummary-hint" className="field-hint -mt-1 mb-2">
          What problem are you trying to solve, and what would a good outcome look like? Please do
          not include passwords or confidential data.
        </p>
        <textarea
          id="field-projectSummary"
          name="projectSummary"
          rows={7}
          required
          maxLength={LIMITS.summaryMax}
          aria-invalid={errors.projectSummary?.length ? true : undefined}
          aria-describedby={describedBy("projectSummary", true)}
          onChange={(e) => setSummaryLength(e.target.value.length)}
          className="input"
        />
        <p className="mt-1 text-right text-xs text-muted" aria-live="polite">
          {summaryLength > LIMITS.summaryMax - 500
            ? `${LIMITS.summaryMax - summaryLength} characters remaining`
            : ""}
        </p>
        {errors.projectSummary?.length ? (
          <p id="field-projectSummary-error" className="field-error">
            {errors.projectSummary[0]}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {show(config.timeline) && (
          <SelectField
            name="timeline"
            label="Timeline"
            required={config.timeline === "required"}
            options={TIMELINES}
            error={errors.timeline}
            describedBy={describedBy("timeline")}
          />
        )}
        {show(config.budget) && (
          <SelectField
            name="budgetRange"
            label="Approximate budget"
            hint="In your preferred currency."
            required={config.budget === "required"}
            options={BUDGETS}
            error={errors.budgetRange}
            describedBy={describedBy("budgetRange", true)}
          />
        )}
      </div>

      <fieldset>
        <legend className="field-label">Preferred contact method</legend>
        <div className="flex flex-wrap gap-6">
          {CONTACT_PREFERENCES.map((p) => (
            <label key={p.value} className="flex min-h-11 items-center gap-2.5">
              <input
                type="radio"
                name="contactPreference"
                value={p.value}
                defaultChecked={p.value === "email"}
                className="h-5 w-5 accent-[var(--color-brand)]"
              />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="flex items-start gap-3">
          <input
            id="field-privacyAcknowledged"
            type="checkbox"
            name="privacyAcknowledged"
            required
            aria-invalid={errors.privacyAcknowledged?.length ? true : undefined}
            aria-describedby={describedBy("privacyAcknowledged")}
            className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-brand)]"
          />
          <span className="text-ink">
            I have read the{" "}
            <Link href="/privacy" className="link" target="_blank">
              privacy notice<span className="sr-only"> (opens in a new tab)</span>
            </Link>{" "}
            and understand my details will be used to respond to this enquiry. <Req />
          </span>
        </label>
        {errors.privacyAcknowledged?.length ? (
          <p id="field-privacyAcknowledged-error" className="field-error ml-8">
            {errors.privacyAcknowledged[0]}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <button
          type="submit"
          className="btn-primary min-w-48"
          disabled={pending}
          aria-disabled={pending}
        >
          {pending ? "Sending…" : submitLabel}
        </button>
        <p className="text-sm text-muted" aria-live="polite">
          {pending ? "Sending your enquiry. Please wait." : ""}
        </p>
      </div>
    </form>
  );
}

function Req() {
  return (
    <span aria-hidden="true" className="text-danger">
      *
    </span>
  );
}

function TextField(props: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  maxLength?: number;
  error?: string[];
  describedBy?: string;
}) {
  const id = fieldId(props.name);
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {props.label}{" "}
        {props.required ? <Req /> : <span className="font-normal text-muted">(optional)</span>}
      </label>
      <input
        id={id}
        name={props.name}
        type={props.type ?? "text"}
        required={props.required}
        autoComplete={props.autoComplete}
        maxLength={props.maxLength}
        aria-invalid={props.error?.length ? true : undefined}
        aria-describedby={props.describedBy}
        className="input"
      />
      {props.error?.length ? (
        <p id={`${id}-error`} className="field-error">
          {props.error[0]}
        </p>
      ) : null}
    </div>
  );
}

function SelectField(props: {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  options: readonly { value: string; label: string }[];
  error?: string[];
  describedBy?: string;
}) {
  const id = fieldId(props.name);
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {props.label}{" "}
        {props.required ? <Req /> : <span className="font-normal text-muted">(optional)</span>}
      </label>
      {props.hint && (
        <p id={`${id}-hint`} className="field-hint -mt-1 mb-2">
          {props.hint}
        </p>
      )}
      <select
        id={id}
        name={props.name}
        required={props.required}
        defaultValue=""
        aria-invalid={props.error?.length ? true : undefined}
        aria-describedby={props.describedBy}
        className="input"
      >
        <option value="">Select…</option>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {props.error?.length ? (
        <p id={`${id}-error`} className="field-error">
          {props.error[0]}
        </p>
      ) : null}
    </div>
  );
}
