import Link from "next/link";
import type { ContentStatus, EnquiryStatus } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/enquiries/status";

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-8">
      {back && (
        <Link href={back.href} className="text-sm text-muted hover:text-ink hover:underline">
          ← {back.label}
        </Link>
      )}
      <div className="mt-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy sm:text-3xl">{title}</h1>
          {description && <p className="mt-1.5 max-w-3xl text-ink-soft">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Panel({
  title,
  children,
  actions,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-lg font-semibold text-navy">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const CONTENT_BADGE: Record<ContentStatus, string> = {
  DRAFT: "bg-surface-strong text-ink-soft",
  IN_REVIEW: "bg-warning-soft text-warning",
  PUBLISHED: "bg-success-soft text-success",
  ARCHIVED: "bg-slate-200 text-slate-700",
};
const CONTENT_LABEL: Record<ContentStatus, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export function ContentStatusBadge({ status, live }: { status: ContentStatus; live: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <span className={`badge ${CONTENT_BADGE[status]}`}>{CONTENT_LABEL[status]}</span>
      {live && status !== "PUBLISHED" && (
        <span className="badge bg-success-soft text-success">Live version online</span>
      )}
    </span>
  );
}

const ENQ_BADGE: Record<EnquiryStatus, string> = {
  NEW: "bg-brand-soft text-brand-strong",
  IN_REVIEW: "bg-warning-soft text-warning",
  QUALIFIED: "bg-blue-50 text-blue-800",
  IN_PROGRESS: "bg-indigo-50 text-indigo-800",
  WON: "bg-success-soft text-success",
  LOST: "bg-slate-200 text-slate-700",
  NOT_QUALIFIED: "bg-slate-200 text-slate-700",
  CLOSED: "bg-slate-200 text-slate-700",
};

export function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
  return <span className={`badge ${ENQ_BADGE[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white p-10 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  children: React.ReactNode;
}) {
  const cls = {
    info: "border-line bg-white text-ink-soft",
    warning: "border-warning/30 bg-warning-soft text-warning",
    danger: "border-danger/30 bg-danger-soft text-danger",
    success: "border-success/30 bg-success-soft text-success",
  }[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`rounded-lg border px-4 py-3 text-sm ${cls}`}
    >
      {children}
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  href,
}: {
  page: number;
  pageCount: number;
  href: (p: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link className="btn-secondary btn-sm" href={href(page - 1)}>
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link className="btn-secondary btn-sm" href={href(page + 1)}>
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
