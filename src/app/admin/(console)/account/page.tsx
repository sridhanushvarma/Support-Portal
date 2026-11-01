import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/guard";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { PASSWORD_MIN } from "@/lib/auth/password";
import { AdminForm, Field, SubmitButton } from "@/components/admin/form";
import { PageHeader, Panel } from "@/components/admin/ui";
import { changePasswordAction } from "./actions";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requireAdminPage(undefined, { allowMfaSetup: true });
  return (
    <>
      <PageHeader title="My account" description={user.email} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Change password">
          <AdminForm action={changePasswordAction} resetOnSuccess className="space-y-4">
            <Field
              name="currentPassword"
              label="Current password"
              type="password"
              autoComplete="current-password"
              required
            />
            <Field
              name="newPassword"
              label="New password"
              type="password"
              autoComplete="new-password"
              required
              hint={`At least ${PASSWORD_MIN} characters.`}
            />
            <Field
              name="confirmPassword"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              required
            />
            <SubmitButton>Change password</SubmitButton>
          </AdminForm>
        </Panel>
        <div className="space-y-6">
          <Panel title="Multi-factor authentication">
            {user.mfaEnabled ? (
              <p className="text-sm text-ink-soft">
                Enabled. If you lose your device, ask an administrator to reset it.
              </p>
            ) : (
              <>
                <p className="text-sm text-ink-soft">
                  Protect your account with an authenticator app.
                </p>
                <Link href="/admin/account/mfa" className="btn-primary btn-sm mt-3">
                  Set up MFA
                </Link>
              </>
            )}
          </Panel>
          <Panel title="Your roles">
            <ul className="space-y-2 text-sm">
              {user.roles.map((r) => (
                <li key={r}>
                  <strong>{ROLE_LABELS[r].label}</strong>: {ROLE_LABELS[r].description}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
