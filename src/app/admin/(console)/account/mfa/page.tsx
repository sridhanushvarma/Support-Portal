import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { requireAdminPage } from "@/lib/auth/guard";
import { newMfaSecret } from "@/lib/auth/login";
import { otpauthUri } from "@/lib/auth/totp";
import { loadSettings } from "@/lib/settings";
import { AdminForm, Field, SubmitButton } from "@/components/admin/form";
import { Notice, PageHeader, Panel } from "@/components/admin/ui";
import { enrolMfaAction } from "../../../auth-actions";

export const metadata: Metadata = { title: "Set up MFA" };

export default async function MfaSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  const user = await requireAdminPage(undefined, { allowMfaSetup: true });
  if (user.mfaEnabled) redirect("/admin/account");
  const { required } = await searchParams;
  const settings = await loadSettings();
  // The secret is only activated after the user proves possession with a valid code.
  const { secret, encrypted } = newMfaSecret();
  const uri = otpauthUri(secret, user.email, `${settings.siteName} Admin`);
  const svg = await QRCode.toString(uri, {
    type: "svg",
    margin: 1,
    width: 200,
    errorCorrectionLevel: "M",
  });

  return (
    <>
      <PageHeader title="Set up multi-factor authentication" />
      {required && (
        <div className="mb-6">
          <Notice tone="warning">
            Your organisation requires MFA for the administration area. Set it up to continue.
          </Notice>
        </div>
      )}
      <Panel className="max-w-2xl">
        <ol className="list-decimal space-y-5 pl-5 text-ink-soft">
          <li>
            Install an authenticator app (for example, Microsoft Authenticator, Google Authenticator
            or 1Password) and scan this code:
            <div
              className="mt-3 w-[200px] rounded-lg border border-line bg-white p-2"
              role="img"
              aria-label="QR code for your authenticator app"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <p className="mt-3 text-sm">Cannot scan? Enter this key manually:</p>
            <p className="mt-1 font-mono text-sm break-all text-ink select-all">
              {secret.match(/.{1,4}/g)?.join(" ")}
            </p>
          </li>
          <li>
            Enter the 6-digit code shown in the app:
            <AdminForm action={enrolMfaAction} className="mt-3 max-w-xs space-y-3">
              <input type="hidden" name="secret" value={encrypted} />
              <Field
                name="code"
                label="Verification code"
                autoComplete="one-time-code"
                maxLength={6}
                required
              />
              <SubmitButton>Turn on MFA</SubmitButton>
            </AdminForm>
          </li>
        </ol>
      </Panel>
    </>
  );
}
