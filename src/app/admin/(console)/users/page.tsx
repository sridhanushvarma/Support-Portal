import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/guard";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { loadSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/format";
import { AdminForm, Field, SubmitButton } from "@/components/admin/form";
import { RolePicker } from "@/components/admin/role-picker";
import { PageHeader, Panel } from "@/components/admin/ui";
import { inviteUserAction } from "./actions";

export const metadata: Metadata = { title: "Users and roles" };

export default async function UsersPage() {
  await requireAdminPage("users.manage");
  const [users, settings] = await Promise.all([
    prisma.adminUser.findMany({
      include: { roles: true },
      orderBy: [{ active: "desc" }, { displayName: "asc" }],
    }),
    loadSettings(),
  ]);
  return (
    <>
      <PageHeader
        title="Users and roles"
        description="Staff accounts for the administration area. There are no public visitor accounts."
      />
      <div className="card mb-8 overflow-x-auto">
        <table className="table-admin">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Roles</th>
              <th scope="col">MFA</th>
              <th scope="col">Last sign-in</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link href={`/admin/users/${u.id}`} className="link">
                    {u.displayName}
                  </Link>
                  <span className="block text-xs text-muted">{u.email}</span>
                </td>
                <td>{u.roles.map((r) => ROLE_LABELS[r.role].label).join(", ")}</td>
                <td>{u.mfaEnabledAt ? "On" : <span className="text-warning">Not set up</span>}</td>
                <td className="whitespace-nowrap">
                  {u.lastSignInAt
                    ? formatDateTime(u.lastSignInAt, settings.adminTimeZone)
                    : u.passwordHash
                      ? "Never"
                      : "Invitation pending"}
                </td>
                <td>{u.active ? "Active" : <span className="text-muted">Deactivated</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Panel title="Invite a user">
        <AdminForm action={inviteUserAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="displayName" label="Full name" required maxLength={120} />
            <Field name="email" label="Work email" type="email" required maxLength={254} />
          </div>
          <RolePicker />
          <SubmitButton>Send invitation</SubmitButton>
        </AdminForm>
      </Panel>
    </>
  );
}
