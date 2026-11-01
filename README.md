# Corporate Technology Website

Stack: Next.js 15 (App Router, React 19, TypeScript strict) · PostgreSQL 18 · Prisma 6 · Zod 4 · Tailwind CSS 4 ·
Vitest · Playwright with axe-core.

## Quick start (development)

Requirements: Node.js 22.12+ and PostgreSQL 15+ (18 recommended).

```bash
cp .env.example .env               # then set DATABASE_URL, APP_SECRET and APP_ENCRYPTION_KEY
openssl rand -base64 32            # use for APP_SECRET
openssl rand -base64 32            # use for APP_ENCRYPTION_KEY
npm ci
npm run db:migrate                 # apply migrations
npm run db:seed                    # starter services and pages (never overwrites edited content)
npm run admin:create -- --email you@example.com --name "Your Name" --roles ADMIN,PUBLISHER,SALES_MANAGER
npm run dev                        # http://localhost:3000, admin at /admin
npm run worker                     # optional: background notification delivery and retention
```

`admin:create` prints a single-use link to set the password. With `ADMIN_MFA_REQUIRED=true` (the default and the
recommended setting outside local development) the first sign-in asks the user to enrol an authenticator app.

In development, `EMAIL_PROVIDER=console` prints emails to the server log instead of sending them.

## Scripts

Commands
| `npm run dev` / `build` / `start`                   | Develop, build (app and worker bundle), serve production build                 |
| `npm run worker`                                    | Background worker (notifications every 15 s, maintenance hourly)               |
| `npm run lint` · `typecheck` · `format:check`       | Static quality gates                                                           |
| `npm test`                                          | Unit tests                                                                     |
| `npm run test:integration`                          | Integration tests against `TEST_DATABASE_URL` (schema is reset)                |
| `npm run test:e2e`                                  | Playwright end-to-end tests against a production build and `E2E_DATABASE_URL`  |
| `npm run db:migrate` · `db:migrate:dev` · `db:seed` | Database migrations and starter content                                        |
| `npm run admin:create`                              | Create or recover an administrator (`--reset-mfa` clears a lost authenticator) |

Test databases must have `test` or `e2e` in their name; the test setup refuses to reset anything else.

## Configuration

All configuration is environment variables, documented in [.env.example](.env.example) and validated at start-up
([src/lib/env.ts](src/lib/env.ts)). Production refuses to start with the console email provider, a non-HTTPS
`SITE_URL` or the example secret. Non-secret business settings (organisation details, enquiry recipients, form
fields, privacy version, retention period, consent mode) are edited in **Admin → Site settings**.

## Project layout

```
src/app/(public)/      public routes (home, services, projects, contact, CMS pages)
src/app/admin/         admin area: sign-in, console pages, server actions, preview
src/app/api/           JSON APIs (v1), health check, scheduled jobs endpoint
src/components/        site and admin UI components
src/lib/               domain logic: auth, content, enquiries, notifications, media, settings, audit
prisma/                schema, migrations, seed content
scripts/               worker, admin bootstrap, worker bundler
tests/                 unit, integration and e2e suites
docs/                  architecture, operations, content guide, API, traceability, go-live checklist
```

## Documentation

- [Architecture and design decisions](docs/architecture.md)
- [Operations runbook](docs/operations.md): deployment, backups and restore, monitoring, incidents
- [Content and publishing guide](docs/content-guide.md) for editors and publishers
- [API reference (OpenAPI 3.1)](docs/api.yaml)
- [Requirements traceability](docs/traceability.md)
- [Go-live checklist](docs/go-live-checklist.md)

## Before launch

The application ships with neutral starter copy. Items in square brackets (company story, mission, vision, privacy
wording, retention period) and the placeholder organisation name must be replaced with approved content. No portfolio
projects are published by default. The admin dashboard's **Launch readiness** panel lists what is still outstanding.
