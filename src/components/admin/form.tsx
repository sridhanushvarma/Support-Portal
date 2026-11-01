"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
} from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/actions";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

/**
 * Admin form that submits through a transition (no automatic reset), keeps the
 * user's input on validation errors, and announces the result.
 */
export function AdminForm({
  action,
  children,
  className = "space-y-6",
  onSuccess,
  resetOnSuccess = false,
  id,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  onSuccess?: (state: ActionState) => void;
  resetOnSuccess?: boolean;
  id?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);
  const status = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state.nonce) return;
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.(state);
    }
    status.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.nonce]);

  return (
    <form
      id={id}
      ref={ref}
      noValidate
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitter?.name) fd.set(submitter.name, submitter.value);
        startTransition(() => formAction(fd));
      }}
    >
      <div ref={status} tabIndex={-1} className="focus:outline-none" aria-live="polite">
        {state.message && (
          <div
            role={state.ok ? "status" : "alert"}
            className={`rounded-lg border px-4 py-3 text-sm ${state.ok ? "border-success/30 bg-success-soft text-success" : "border-danger/30 bg-danger-soft text-danger"}`}
          >
            {state.message}
            {state.data && (
              <dl className="mt-2 space-y-1 text-ink">
                {Object.entries(state.data).map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-semibold">{k}</dt>
                    <dd className="break-all font-mono text-xs select-all">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </div>
      <FieldErrorsContext.Provider value={state.ok ? {} : (state.fieldErrors ?? {})}>
        {children}
      </FieldErrorsContext.Provider>
    </form>
  );
}

const FieldErrorsContext = createContext<Record<string, string[]>>({});
export const useFieldError = (name: string) => useContext(FieldErrorsContext)[name]?.[0];

export function SubmitButton({
  children,
  className = "btn-primary",
  name,
  value,
  pendingLabel = "Saving…",
}: {
  children: React.ReactNode;
  className?: string;
  name?: string;
  value?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} className={className} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

interface FieldProps {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  defaultValue?: string | number | null;
  type?: string;
  maxLength?: number;
  rows?: number;
  autoComplete?: string;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

export function Field({
  name,
  label,
  hint,
  required,
  defaultValue,
  type = "text",
  maxLength,
  rows,
  autoComplete,
  disabled,
  placeholder,
  id: explicitId,
}: FieldProps) {
  const error = useFieldError(name);
  const id = explicitId ?? `f-${name.replace(/[^\w-]/g, "-")}`;
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}{" "}
        {required && (
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="field-hint -mt-1 mb-1.5">
          {hint}
        </p>
      )}
      {rows ? (
        <textarea
          id={id}
          name={name}
          rows={rows}
          required={required}
          maxLength={maxLength}
          defaultValue={defaultValue ?? ""}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          placeholder={placeholder}
          className="input"
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          required={required}
          maxLength={maxLength}
          defaultValue={defaultValue ?? ""}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoComplete={autoComplete}
          disabled={disabled}
          placeholder={placeholder}
          className="input"
        />
      )}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function Select({
  name,
  label,
  options,
  defaultValue,
  hint,
  required,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  hint?: string;
  required?: boolean;
}) {
  const error = useFieldError(name);
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}{" "}
        {required && (
          <span aria-hidden="true" className="text-danger">
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="field-hint -mt-1 mb-1.5">
          {hint}
        </p>
      )}
      <select
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") ||
          undefined
        }
        className="input"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function Checkbox({
  name,
  label,
  defaultChecked,
  hint,
  value = "on",
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  hint?: string;
  value?: string;
}) {
  const id = `f-${name}-${value}`;
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-brand)]"
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      <div>
        <label htmlFor={id} className="font-medium text-ink">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="text-sm text-muted">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

export function FormError({ name }: { name: string }) {
  const error = useFieldError(name);
  return error ? <p className="field-error">{error}</p> : null;
}
