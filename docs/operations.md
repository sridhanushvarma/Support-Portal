# Operations runbook

Audience: technical operations and the technical owner.

## Environments

Use separate development, staging and production environments with separate databases, secrets, email credentials
and media storage (FR-OPS-004). Never copy production enquiry data into other environments. Set
`SITE_INDEXABLE=true` only in production. Set `APP_ENV=production` in production; this enables start-up checks for
HTTPS, a real email provider and non-example secrets.

## Deploying with Docker Compose (single host)

```bash
cp .env.example .env.production        # fill in every value; generate secrets with: openssl rand -base64 32
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production run --rm tools npm run admin:create -- --email you@company.com --name "Your Name"
```

The stack runs `db` (PostgreSQL 18), `tools` (applies migrations, then exits), `app` (port 3000 on localhost) and
`worker`. Put a TLS-terminating reverse proxy in front of `app` that sets `X-Forwarded-For`, and keep
`TRUST_PROXY=true`. Without a trusted proxy header, rate limits cannot distinguish visitors.

Other platforms: build the `runner` image target, run `node server.js` for the web process and
`node dist/worker.mjs` for the worker, and run `npx prisma migrate deploy` (the `tools` target) before each release.
On platforms without long-running workers, call `POST /api/internal/jobs` every minute with
`Authorization: Bearer $CRON_SECRET` instead.

## Release procedure

1. CI must pass: audit, format, lint, typecheck, schema drift check, unit, integration and end-to-end tests.
2. Take a database backup and confirm it completed.
3. Apply migrations (`tools` service or `npx prisma migrate deploy`). Migrations are forward-only; review any
   destructive step before release.
4. Deploy the new `app` and `worker` images.
5. Smoke test: `/api/health?ready=1`, home, a service page, `/projects`, `/contact`, `/sitemap.xml`, `/robots.txt`,
   admin sign-in, and one test enquiry in staging.

**Rollback:** redeploy the previous image. If a migration must be undone, restore the pre-release backup; rolling
back code does not reverse data migrations.

## Configuration reference

| Variable                                 | Notes                                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `SITE_URL`                               | Canonical HTTPS origin. Used for canonical URLs, sitemap, email links and the cookie prefix.                     |
| `DATABASE_URL`                           | Use `sslmode=require` for managed databases. Use a least-privilege role (no superuser).                          |
| `APP_SECRET`                             | Signs form tokens and keys IP hashes. Rotating it invalidates open contact forms only.                           |
| `APP_ENCRYPTION_KEY`                     | Encrypts TOTP secrets. Rotating it requires every user to re-enrol MFA (`admin:create --reset-mfa`).             |
| `ADMIN_MFA_REQUIRED`                     | Keep `true` outside local development.                                                                           |
| `EMAIL_PROVIDER`, `SMTP_*`, `EMAIL_FROM` | SMTP works with Amazon SES, SendGrid, Postmark and others. Configure SPF, DKIM and DMARC for the sending domain. |
| `OPS_ALERT_EMAIL`                        | Receives an alert when a notification exhausts its retries. Required for UC-09.                                  |
| `TRUST_PROXY`                            | `true` only behind a proxy you control.                                                                          |
| `MEDIA_STORAGE_DIR`                      | Persistent volume. Include it in backups.                                                                        |
| `CRON_SECRET`                            | 24+ characters; enables `/api/internal/jobs`.                                                                    |
| `NEXT_PUBLIC_ANALYTICS_*`                | Build-time. Plausible-compatible script URL and domain; loaded only as consent allows.                           |

## Backups and restore (FR-OPS-003, NFR-16)

Agree the recovery point objective (RPO) and recovery time objective (RTO) with the business owner, then:

- Database: enable managed point-in-time recovery, or schedule `pg_dump --format=custom` at least daily, encrypted
  and stored off-host with restricted access. Keep backups only as long as the retention policy allows; enquiries
  deleted or anonymised in the live system remain in older backups until those expire.
- Media: back up the media volume on the same schedule.

**Restore test (required before go-live, then quarterly):**

```bash
createdb corpweb_restore_test
pg_restore --no-owner --dbname=corpweb_restore_test backup.dump
DATABASE_URL=postgresql://…/corpweb_restore_test npx prisma migrate status   # expect "up to date"
psql corpweb_restore_test -c 'select count(*) from "Enquiry"; select count(*) from "Service" where "publishedSlug" is not null;'
```

Start the app against the restored database in a non-production environment, open the home page, a project and the
enquiry inbox, then record the date, duration, data checked and any issues in the operations log (UAT-10).

## Monitoring and alerting (FR-OPS-002, NFR-19)

- Uptime: monitor `GET /api/health?ready=1` every minute from outside the network. Alert after two consecutive
  failures. The monthly availability target proposed in NFR-03 is 99.5%.
- Logs: ship stdout JSON logs to your log platform. Useful queries: `level=error`, `msg=notifications.dead`,
  `msg=enquiry.persist_failed`, `msg=authz.denied`, `msg=auth.rate_limited`. Every response carries `X-Request-Id`
  for correlation.
- Notification health: **Admin → Notification health** lists failing and dead notifications with a retry button.
  The dashboard shows a red banner when any notification is dead.
- Performance: measure Core Web Vitals from real users once traffic allows (targets in NFR-01) and run Lighthouse on
  key routes before each major release.

## Incident procedures

**Notification failures (UC-09).** Enquiries are always stored before email is attempted. Open Notification health,
note the error class, check provider status, credentials, quota and sender verification. Follow up affected
enquiries manually from the inbox. After fixing the cause, press Retry now.

**Database unavailable.** The contact form shows an error with an alternative contact route and never claims
success. Restore database service; nothing needs replaying.

**User locked out or lost authenticator.** Another administrator opens Users → the user → Reset MFA or Send password
reset link. If no administrator can sign in: `npm run admin:create -- --email admin@company.com --reset-mfa` from the
`tools` image prints a fresh setup link.

**Suspected account compromise.** Deactivate the account (signs out all sessions), review the audit log filtered by
actor, rotate any exposed credentials, then reactivate with a reset link.

**Spam wave.** Rate limits apply per visitor. Check `enquiry.rate_limited` and `enquiry.spam_honeypot` logs. If
needed, add a WAF or CDN bot rule in front of `POST /contact` and `POST /api/v1/enquiries`.

## Data retention (NFR-14)

The worker anonymises enquiries in a closed state (Won, Lost, Not qualified, Closed) that have had no activity for the
retention period configured in Site settings (default 730 days; confirm with your privacy adviser). Sent notifications
are purged after 90 days; expired sessions, setup links and rate-limit buckets are cleaned hourly. Audit events are
kept indefinitely by default; define a retention period with your privacy adviser and prune with a scheduled SQL
job if required. Individual erasure requests: open the enquiry → Remove personal data.

## Security maintenance (NFR-24)

- Dependencies are pinned in `package-lock.json`; CI fails on high-severity advisories (`npm audit`).
- Review and apply framework security releases (Next.js, React, Prisma) promptly; test in staging first.
- Restrict CI and deployment tokens to the minimum scope. Store secrets only in the platform secret manager.
