import Link from "next/link";
import type { ContentStatus } from "@prisma/client";
import { formatDateTime } from "@/lib/format";
import { ContentStatusBadge, EmptyState } from "./ui";

export interface ContentRow {
  id: string;
  title: string;
  path: string;
  status: ContentStatus;
  live: boolean;
  updatedAt: Date;
  extra?: string;
}

export function ContentList({
  rows,
  base,
  timeZone,
  emptyText,
}: {
  rows: ContentRow[];
  base: string;
  timeZone: string;
  emptyText: string;
}) {
  if (rows.length === 0) return <EmptyState title={emptyText} />;
  return (
    <div className="card overflow-x-auto">
      <table className="table-admin">
        <thead>
          <tr>
            <th scope="col">Title</th>
            <th scope="col">URL</th>
            <th scope="col">Status</th>
            <th scope="col">Last edited</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-surface">
              <td>
                <Link href={`${base}/${r.id}`} className="link">
                  {r.title}
                </Link>
                {r.extra && <span className="block text-xs text-muted">{r.extra}</span>}
              </td>
              <td className="font-mono text-xs text-ink-soft">{r.path}</td>
              <td>
                <ContentStatusBadge status={r.status} live={r.live} />
              </td>
              <td className="whitespace-nowrap">{formatDateTime(r.updatedAt, timeZone)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
