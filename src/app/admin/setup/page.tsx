import type { Metadata } from "next";
import Link from "next/link";
import { findValidSetupToken } from "@/lib/users";
import { PASSWORD_MIN } from "@/lib/auth/password";
import { AuthCard } from "@/components/admin/auth-card";
import { AdminForm, Field, SubmitButton } from "@/components/admin/form";
import { setupPasswordAction } from "../auth-actions";

export const metadata: Metadata = { title: "Set your password", referrer: "no-referrer" };

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const row = token ? await findValidSetupToken(token) : null;
  if (!row) {
    return (
      <AuthCard
        title="Link not valid"
        intro="This link is invalid, has already been used, or has expired. Ask an administrator for a new link."
      >
        <Link href="/admin/login" className="link">
          Go to sign in
        </Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Set your password" intro={`Signing in as ${row.user.email}.`}>
      <AdminForm action={setupPasswordAction}>
        <input type="hidden" name="token" value={token} />
        <Field
          name="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          hint={`At least ${PASSWORD_MIN} characters. A passphrase of several words works well.`}
        />
        <Field
          name="confirm"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
        />
        <SubmitButton className="btn-primary w-full">Set password</SubmitButton>
      </AdminForm>
    </AuthCard>
  );
}
