import "server-only";
import { prisma } from "./db";
import { env } from "./env";
import type { SiteSettings } from "./settings";
import { STATUS_LABELS } from "./enquiries/status";

/** Aggregated, personal-data-free reporting for the dashboard (UC-08, success measures 2.3). */
export async function enquiryReport(days = 90) {
  const since = new Date(Date.now() - days * 86400_000);
  const [byStatus, byService, bySource, weekly, response, total] = await Promise.all([
    prisma.enquiry.groupBy({
      by: ["status"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ label: string; n: bigint }[]>`
      SELECT esi."serviceLabel" AS label, count(*)::bigint AS n FROM "EnquiryServiceInterest" esi
      JOIN "Enquiry" e ON e.id = esi."enquiryId" WHERE e."createdAt" >= ${since}
      GROUP BY esi."serviceLabel" ORDER BY n DESC LIMIT 10`,
    prisma.$queryRaw<{ label: string; n: bigint }[]>`
      SELECT coalesce(nullif(e."utmSource", ''), nullif(e."referrerHost", ''), 'direct / unknown') AS label, count(*)::bigint AS n
      FROM "Enquiry" e WHERE e."createdAt" >= ${since} GROUP BY 1 ORDER BY n DESC LIMIT 10`,
    prisma.$queryRaw<{ week: Date; n: bigint }[]>`
      SELECT date_trunc('week', "createdAt") AS week, count(*)::bigint AS n FROM "Enquiry"
      WHERE "createdAt" >= now() - interval '12 weeks' GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ median_hours: number | null; responded: bigint }[]>`
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM ("firstResponseAt" - "createdAt")) / 3600.0) AS median_hours,
             count(*)::bigint AS responded
      FROM "Enquiry" WHERE "createdAt" >= ${since} AND "firstResponseAt" IS NOT NULL`,
    prisma.enquiry.count({ where: { createdAt: { gte: since } } }),
  ]);
  const qualified = byStatus
    .filter((s) => ["QUALIFIED", "IN_PROGRESS", "WON"].includes(s.status))
    .reduce((a, s) => a + s._count._all, 0);
  return {
    days,
    total,
    qualified,
    byStatus: byStatus
      .map((s) => ({ label: STATUS_LABELS[s.status], n: s._count._all }))
      .sort((a, b) => b.n - a.n),
    byService: byService.map((r) => ({ label: r.label, n: Number(r.n) })),
    bySource: bySource.map((r) => ({ label: r.label, n: Number(r.n) })),
    weekly: weekly.map((r) => ({ week: r.week.toISOString().slice(0, 10), n: Number(r.n) })),
    medianFirstResponseHours: response[0]?.median_hours ?? null,
    responded: Number(response[0]?.responded ?? 0),
  };
}

export async function notificationHealth() {
  const [dead, failing, pending] = await Promise.all([
    prisma.notification.count({ where: { status: "DEAD" } }),
    prisma.notification.count({ where: { status: "FAILED" } }),
    prisma.notification.count({
      where: { status: "PENDING", nextAttemptAt: { lt: new Date(Date.now() - 10 * 60_000) } },
    }),
  ]);
  return { dead, failing, stalePending: pending };
}

export async function staleContent(reviewDays: number) {
  const cutoff = new Date(Date.now() - reviewDays * 86400_000);
  const where = {
    publishedSlug: { not: null },
    OR: [{ lastReviewedAt: null }, { lastReviewedAt: { lt: cutoff } }],
  };
  const select = { id: true, lastReviewedAt: true } as const;
  const [services, projects, pages] = await Promise.all([
    prisma.service.findMany({ where, select: { ...select, name: true } }),
    prisma.project.findMany({ where, select: { ...select, title: true } }),
    prisma.page.findMany({ where, select: { ...select, title: true } }),
  ]);
  return [
    ...services.map((s) => ({
      kind: "service" as const,
      id: s.id,
      title: s.name,
      lastReviewedAt: s.lastReviewedAt,
    })),
    ...projects.map((p) => ({
      kind: "project" as const,
      id: p.id,
      title: p.title,
      lastReviewedAt: p.lastReviewedAt,
    })),
    ...pages.map((p) => ({
      kind: "page" as const,
      id: p.id,
      title: p.title,
      lastReviewedAt: p.lastReviewedAt,
    })),
  ];
}

export async function reviewQueue() {
  const where = { status: "IN_REVIEW" as const };
  const [services, projects, pages] = await Promise.all([
    prisma.service.findMany({ where, select: { id: true, name: true, updatedAt: true } }),
    prisma.project.findMany({ where, select: { id: true, title: true, updatedAt: true } }),
    prisma.page.findMany({ where, select: { id: true, title: true, updatedAt: true } }),
  ]);
  return [
    ...services.map((s) => ({
      kind: "service" as const,
      id: s.id,
      title: s.name,
      updatedAt: s.updatedAt,
    })),
    ...projects.map((p) => ({
      kind: "project" as const,
      id: p.id,
      title: p.title,
      updatedAt: p.updatedAt,
    })),
    ...pages.map((p) => ({
      kind: "page" as const,
      id: p.id,
      title: p.title,
      updatedAt: p.updatedAt,
    })),
  ];
}

export interface ReadinessCheck {
  label: string;
  ok: boolean;
  detail: string;
}

/** Go-live checks derived from spec 13.2 and Appendix B that the application can verify itself. */
export async function launchReadiness(settings: SiteSettings): Promise<ReadinessCheck[]> {
  const e = env();
  const [liveServices, liveProjects, privacy, about, admins, adminsWithoutMfa, deadNotifications] =
    await Promise.all([
      prisma.service.count({ where: { publishedSlug: { not: null } } }),
      prisma.project.count({ where: { publishedSlug: { not: null } } }),
      prisma.page.findUnique({ where: { slug: "privacy" }, select: { publishedSlug: true } }),
      prisma.page.findUnique({ where: { slug: "about" }, select: { publishedSlug: true } }),
      prisma.adminUser.count({ where: { active: true, roles: { some: { role: "ADMIN" } } } }),
      prisma.adminUser.count({ where: { active: true, mfaEnabledAt: null } }),
      prisma.notification.count({ where: { status: "DEAD" } }),
    ]);
  return [
    {
      label: "Organisation name set",
      ok: settings.siteName !== "Your Company",
      detail: "Replace the placeholder name in Settings.",
    },
    {
      label: "Contact email published",
      ok: Boolean(settings.contactEmail),
      detail: "Set an approved contact email in Settings.",
    },
    {
      label: "Enquiry notification recipients",
      ok: settings.enquiryRecipients.length > 0,
      detail: "Add at least one team mailbox in Settings.",
    },
    {
      label: "Five service pages live",
      ok: liveServices >= 5,
      detail: `${liveServices} service page(s) are live.`,
    },
    {
      label: "At least one approved project live",
      ok: liveProjects > 0,
      detail: `${liveProjects} project(s) are live.`,
    },
    {
      label: "About page live",
      ok: Boolean(about?.publishedSlug),
      detail: "Publish the About page.",
    },
    {
      label: "Privacy notice live and approved",
      ok:
        Boolean(privacy?.publishedSlug) &&
        settings.privacyApproved &&
        settings.privacyPolicyVersion !== "draft",
      detail:
        "Publish legal-approved privacy wording, set its version and mark it approved in Settings.",
    },
    {
      label: "Production email provider",
      ok: e.EMAIL_PROVIDER === "smtp",
      detail: `EMAIL_PROVIDER is "${e.EMAIL_PROVIDER}".`,
    },
    {
      label: "Operations alert address",
      ok: Boolean(e.OPS_ALERT_EMAIL),
      detail: "Set OPS_ALERT_EMAIL so failed notifications raise an alert.",
    },
    {
      label: "HTTPS site URL",
      ok: e.SITE_URL.startsWith("https://"),
      detail: `SITE_URL is ${e.SITE_URL}.`,
    },
    {
      label: "MFA enforced for admin users",
      ok: e.ADMIN_MFA_REQUIRED && adminsWithoutMfa === 0,
      detail: `ADMIN_MFA_REQUIRED=${e.ADMIN_MFA_REQUIRED}; ${adminsWithoutMfa} active user(s) without MFA.`,
    },
    {
      label: "Two or more administrators",
      ok: admins >= 2,
      detail: `${admins} active administrator(s). A second avoids lock-out.`,
    },
    {
      label: "Proxy headers trusted",
      ok: e.TRUST_PROXY,
      detail: "Set TRUST_PROXY=true behind your load balancer so rate limits apply per visitor.",
    },
    {
      label: "No undelivered notifications",
      ok: deadNotifications === 0,
      detail: `${deadNotifications} notification(s) need attention.`,
    },
  ];
}
