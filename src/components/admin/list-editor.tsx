"use client";

import { useId, useState } from "react";
import { useFieldError } from "./form";

export interface ListField {
  key: string;
  label: string;
  type?: "text" | "textarea" | "select";
  options?: { value: string; label: string }[];
  maxLength?: number;
  hint?: string;
}

type Row = Record<string, string>;

/**
 * Repeatable structured list (capabilities, FAQs, outcomes…). The value is
 * submitted as JSON in a hidden input and fully re-validated on the server.
 */
export function ListEditor({
  name,
  label,
  hint,
  fields,
  initial,
  max = 12,
  addLabel = "Add item",
}: {
  name: string;
  label: string;
  hint?: string;
  fields: ListField[];
  initial: Row[];
  max?: number;
  addLabel?: string;
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const base = useId();
  const error = useFieldError(name);
  const empty = () => Object.fromEntries(fields.map((f) => [f.key, f.options?.[0]?.value ?? ""]));
  const update = (i: number, key: string, value: string) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [key]: value } : row)));
  const move = (i: number, d: -1 | 1) =>
    setRows((r) => {
      const next = [...r];
      const [item] = next.splice(i, 1);
      next.splice(i + d, 0, item!);
      return next;
    });

  return (
    <fieldset className="rounded-xl border border-line p-4 sm:p-5">
      <legend className="px-1 text-sm font-semibold text-ink">{label}</legend>
      {hint && <p className="mb-3 text-sm text-muted">{hint}</p>}
      <input type="hidden" name={name} value={JSON.stringify(rows)} readOnly />
      {typeof error === "string" && <p className="field-error mb-3">{error}</p>}
      <ol className="space-y-4">
        {rows.map((row, i) => (
          <li key={i} className="rounded-lg bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink-soft">Item {i + 1}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move item ${i + 1} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => move(i, 1)}
                  disabled={i === rows.length - 1}
                  aria-label={`Move item ${i + 1} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm text-danger"
                  onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                  aria-label={`Remove item ${i + 1}`}
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="grid gap-3">
              {fields.map((f) => {
                const id = `${base}-${i}-${f.key}`;
                return (
                  <div key={f.key}>
                    <label htmlFor={id} className="field-label">
                      {f.label}
                    </label>
                    {f.hint && <p className="field-hint -mt-1 mb-1">{f.hint}</p>}
                    {f.type === "textarea" ? (
                      <textarea
                        id={id}
                        rows={3}
                        className="input"
                        maxLength={f.maxLength}
                        value={row[f.key] ?? ""}
                        onChange={(e) => update(i, f.key, e.target.value)}
                      />
                    ) : f.type === "select" ? (
                      <select
                        id={id}
                        className="input"
                        value={row[f.key] ?? ""}
                        onChange={(e) => update(i, f.key, e.target.value)}
                      >
                        {f.options?.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={id}
                        className="input"
                        maxLength={f.maxLength}
                        value={row[f.key] ?? ""}
                        onChange={(e) => update(i, f.key, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      {rows.length === 0 && <p className="text-sm text-muted">No items yet.</p>}
      <button
        type="button"
        className="btn-secondary btn-sm mt-4"
        disabled={rows.length >= max}
        onClick={() => setRows((r) => [...r, empty()])}
      >
        + {addLabel}
      </button>
    </fieldset>
  );
}
