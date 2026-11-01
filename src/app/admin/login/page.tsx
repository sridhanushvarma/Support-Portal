import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { AuthCard } from "@/components/admin/auth-card";
import { AdminForm, Field, SubmitButton } from "@/components/admin/form";
import { loginAction } from "../auth-actions";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ next?: string; setup?: string; signedout?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const sp = await searchParams;
  const session = await getCurrentSession();
  if (session && !session.mfaPending) redirect("/admin");
  return (
    <AuthCard title="Sign in" intro="For authorised staff only.">
      {sp.setup && (
        <p role="status" className="mb-4 rounded-lg bg-success-soft px-4 py-3 text-sm text-success">
          Your password is set. Sign in to continue.
        </p>
      )}
      {sp.signedout && (
        <p role="status" className="mb-4 rounded-lg bg-surface px-4 py-3 text-sm text-ink-soft">
          You have signed out.
        </p>
      )}
      <AdminForm action={loginAction}>
        <input type="hidden" name="next" value={sp.next ?? "/admin"} />
        <Field name="email" label="Email" type="email" autoComplete="username" required />
        <Field
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
        />
        <SubmitButton className="btn-primary w-full" pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </AdminForm>
      <p className="mt-6 text-sm text-muted">
        Forgotten your password? Ask an administrator to send you a reset link.
      </p>
    </AuthCard>
  );
}
