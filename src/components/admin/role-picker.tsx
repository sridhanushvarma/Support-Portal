import type { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { FormError } from "./form";

export function RolePicker({ selected = [] }: { selected?: Role[] }) {
  return (
    <fieldset>
      <legend className="field-label">Roles</legend>
      <p className="field-hint -mt-1 mb-2">Grant only what the person needs for their job.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
          <label
            key={r}
            className="flex items-start gap-2.5 rounded-lg border border-line p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
          >
            <input
              type="checkbox"
              name="roles"
              value={r}
              defaultChecked={selected.includes(r)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
            />
            <span>
              <span className="font-semibold text-ink">{ROLE_LABELS[r].label}</span>
              <span className="block text-muted">{ROLE_LABELS[r].description}</span>
            </span>
          </label>
        ))}
      </div>
      <FormError name="roles" />
    </fieldset>
  );
}
