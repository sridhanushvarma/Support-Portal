import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { AuthCard } from "@/components/admin/auth-card";
import { AdminForm, Field, SubmitButton } from "@/components/admin/form";
import { logoutAction, verifyMfaAction } from "../../auth-actions";

export const metadata: Metadata = { title: "Verify sign-in" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const session = await getCurrentSession();
  if (!session) redirect("/admin/login");
  if (!session.mfaPending) redirect("/admin");
  return (
    <AuthCard
      title="Enter your verification code"
      intro="Open your authenticator app and enter the 6-digit code for this site."
    >
      <AdminForm action={verifyMfaAction}>
        <input type="hidden" name="next" value={next ?? "/admin"} />
        <Field
          name="code"
          label="Verification code"
          autoComplete="one-time-code"
          required
          maxLength={6}
        />
        <SubmitButton className="btn-primary w-full" pendingLabel="Checking…">
          Verify
        </SubmitButton>
      </AdminForm>
      <form action={logoutAction} className="mt-4">
        <button type="submit" className="link text-sm">
          Cancel and sign out
        </button>
      </form>
    </AuthCard>
  );
}
