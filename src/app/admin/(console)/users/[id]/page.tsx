import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guard";
import { loadSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/format";
import { AdminForm, Field, SubmitButton } from "@/components/admin/form";
import { RolePicker } from "@/components/admin/role-picker";
import { Notice, PageHeader, Panel } from "@/components/admin/ui";
import { updateUserAction } from "../actions";

export const metadata: Metadata = { title: "User" };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdminPage("users.manage");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await prisma.adminUser.findUnique({
    where: { id },
    include: { roles: true, _count: { select: { sessions: true } } },
  });
  if (!user) notFound();
  const settings = await loadSettings();
  const self = user.id === me.id;
  return (
    <>
      <PageHeader
        back={{ href: "/admin/users", label: "Users" }}
        title={user.displayName}
        description={user.email}
      />
      {self && (
        <div className="mb-4">
          <Notice tone="info">
            This is your account. Another administrator must change your roles or reset your MFA.
          </Notice>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Panel title="Profile and roles">
          <AdminForm action={updateUserAction} className="space-y-4">
            <input type="hidden" name="id" value={user.id} />
            <Field
              name="displayName"
              label="Full name"
              defaultValue={user.displayName}
              maxLength={120}
            />
            <RolePicker selected={user.roles.map((r) => r.role)} />
            <SubmitButton name="op" value="roles">
              Save
            </SubmitButton>
          </AdminForm>
        </Panel>
        <div className="space-y-6">
          <Panel title="Account">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted">Status</dt>
                <dd>{user.active ? "Active" : "Deactivated"}</dd>
              </div>
              <div>
                <dt className="text-muted">MFA</dt>
                <dd>
                  {user.mfaEnabledAt
                    ? `Enabled ${formatDateTime(user.mfaEnabledAt, settings.adminTimeZone)}`
                    : "Not set up"}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Last sign-in</dt>
                <dd>{formatDateTime(user.lastSignInAt, settings.adminTimeZone)}</dd>
              </div>
              <div>
                <dt className="text-muted">Active sessions</dt>
                <dd>{user._count.sessions}</dd>
              </div>
              {user.lockedUntil && user.lockedUntil > new Date() && (
                <div>
                  <dt className="text-muted">Locked until</dt>
                  <dd className="text-danger">
                    {formatDateTime(user.lockedUntil, settings.adminTimeZone)}
                  </dd>
                </div>
              )}
            </dl>
            {!self && (
              <AdminForm action={updateUserAction} className="mt-5 flex flex-col gap-2">
                <input type="hidden" name="id" value={user.id} />
                <SubmitButton name="op" value="reset-password" className="btn-secondary btn-sm">
                  Send password reset link
                </SubmitButton>
                {user.mfaEnabledAt && (
                  <SubmitButton name="op" value="reset-mfa" className="btn-secondary btn-sm">
                    Reset MFA (lost device)
                  </SubmitButton>
                )}
                {user.active ? (
                  <SubmitButton name="op" value="deactivate" className="btn-danger btn-sm">
                    Deactivate account
                  </SubmitButton>
                ) : (
                  <SubmitButton name="op" value="activate" className="btn-secondary btn-sm">
                    Re-activate account
                  </SubmitButton>
                )}
              </AdminForm>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
