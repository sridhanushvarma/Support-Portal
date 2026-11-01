# Requirements traceability

Audience: product owner, QA and reviewers. Maps the specification's requirement IDs to the implementation and to
verification evidence. Test files: `tests/unit` (U), `tests/integration` (I), `tests/e2e` (E).

Status key: **Done** implemented and tested · **Done (manual)** implemented, verification needs a person or
production data · **Deferred** intentionally not built, with reason.

## Functional requirements

| ID                                 | Status                                      | Implementation                                                                       | Verification                                  |
| ---------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| FR-GEN-001 Global shell            | Done                                        | `components/site/public-shell.tsx`, header, footer                                   | E public.spec (navigation)                    |
| FR-GEN-002 Responsive menu         | Done                                        | `components/site/mobile-nav.tsx` (disclosure, Escape, focus return)                  | E responsive.spec                             |
| FR-GEN-003 CTA placement           | Done                                        | Home hero/footer, service hero/footer, project sidebar/footer                        | E public.spec (UAT-01)                        |
| FR-GEN-004 Route states            | Done                                        | `not-found.tsx`, `(public)/error.tsx`, `global-error.tsx`, empty states, form errors | E public.spec (404), enquiry-admin.spec       |
| FR-GEN-005 Brand tokens            | Done                                        | `app/globals.css` theme tokens and component classes                                 | axe colour-contrast in E                      |
| FR-HOME-001 Home blocks            | Done                                        | `(public)/page.tsx`                                                                  | E public.spec                                 |
| FR-CORP-001 About content          | Done (manual)                               | CMS page `about`                                                                     | Content owner sign-off                        |
| FR-CORP-002 Contact details        | Done                                        | Settings → footer and contact page; hidden when empty                                | Dashboard readiness check                     |
| FR-CORP-003 Delivery approach      | Done                                        | CMS page `approach`, service delivery steps                                          | E enquiry-admin.spec (publishing)             |
| FR-SRV-001 Service index           | Done                                        | `(public)/services/page.tsx`, admin services                                         | E public.spec                                 |
| FR-SRV-002 Service template        | Done                                        | `components/site/service-detail.tsx` (optional modules omitted)                      | E public.spec, axe                            |
| FR-SRV-003 Service taxonomy        | Done                                        | `ProjectService` relation, filters                                                   | I content.test                                |
| FR-SRV-004 Related content         | Done                                        | `fetchRelatedProjects` (published only)                                              | I content.test                                |
| FR-SRV-005 Claims control          | Done                                        | Outcomes illustrative by default; verified needs evidence note; publish blockers     | U domain-rules, I content.test                |
| FR-PORT-001 Project listing        | Done                                        | `(public)/projects/page.tsx`                                                         | E public.spec, I content.test                 |
| FR-PORT-002 Filtering              | Done                                        | URL-based service filter and reset                                                   | E public.spec (UAT-02)                        |
| FR-PORT-003 Project detail         | Done                                        | `components/site/project-detail.tsx` (empty sections hidden)                         | E public.spec                                 |
| FR-PORT-004 Case-study permissions | Done                                        | Client permission, evidence approval, DB constraint                                  | U domain-rules, I content.test (UAT-07)       |
| FR-PORT-005 No-result state        | Done                                        | Explanatory empty state with reset                                                   | E public.spec                                 |
| FR-PORT-006 Slug change handling   | Done                                        | Automatic 308 redirect on publish                                                    | I content.test, E enquiry-admin.spec (UAT-08) |
| FR-ENQ-001 Form fields             | Done                                        | `components/site/enquiry-form.tsx`, configurable optional fields                     | U domain-rules                                |
| FR-ENQ-002 Multiple services       | Done                                        | `EnquiryServiceInterest` join table                                                  | I enquiries.test, E (UAT-04)                  |
| FR-ENQ-003 Client validation       | Done                                        | Shared Zod schema, inline errors, error summary                                      | E enquiry-admin.spec                          |
| FR-ENQ-004 Server validation       | Done                                        | `enquiries/submit.ts`, request-size limits, DB constraints                           | U, I enquiries.test                           |
| FR-ENQ-005 Idempotency             | Done                                        | Signed form nonce / `Idempotency-Key`, unique constraint                             | I enquiries.test (concurrent)                 |
| FR-ENQ-006 Spam controls           | Done                                        | Honeypot, minimum fill time, DB rate limits; no CAPTCHA barrier                      | U, I enquiries.test                           |
| FR-ENQ-007 Success receipt         | Done                                        | Redirect to `/thank-you` only after commit                                           | E enquiry-admin.spec                          |
| FR-ENQ-008 Acknowledgement email   | Done                                        | Outbox `enquiry_ack`, toggle in settings                                             | I enquiries.test                              |
| FR-ENQ-009 Internal notification   | Done                                        | Outbox `enquiry_internal`, minimal content, failure detection                        | I enquiries.test                              |
| FR-ENQ-010 Attachments (Could)     | Deferred                                    | Disabled per DEC-04 recommendation                                                   | —                                             |
| FR-ADM-001 Admin authentication    | Done                                        | Sessions, middleware redirect, server guards                                         | I admin.test, E enquiry-admin.spec            |
| FR-ADM-002 Role permissions        | Done                                        | `auth/permissions.ts`, guards, domain checks                                         | U auth.test, I admin/content tests            |
| FR-ADM-003 Page management         | Done                                        | Admin pages editor and workflow                                                      | E enquiry-admin.spec                          |
| FR-ADM-004 Service management      | Done                                        | Admin services editor                                                                | I content.test                                |
| FR-ADM-005 Project management      | Done                                        | Admin projects editor                                                                | I content.test                                |
| FR-ADM-006 Publication states      | Done (scheduled publish deferred, optional) | `content/workflow.ts`                                                                | U domain-rules, I content.test                |
| FR-ADM-007 Preview                 | Done                                        | `/admin/preview/{kind}/{id}` (authenticated, noindex)                                | Manual                                        |
| FR-ADM-008 Media handling          | Done                                        | Magic-byte detection, sharp re-encode, alt text required                             | U domain-rules (detection)                    |
| FR-ADM-009 Admin session           | Done                                        | Idle/absolute expiry, revocation on logout, password change, deactivation            | I admin.test                                  |
| FR-ADM-010 User administration     | Done                                        | Invite, roles, deactivate, MFA reset, last-admin protection                          | I admin.test                                  |
| FR-LEAD-001 Lead inbox             | Done                                        | Paginated, permission-checked                                                        | I admin.test                                  |
| FR-LEAD-002 Lead detail            | Done                                        | Detail with consent, source, activity, notification status                           | E enquiry-admin.spec                          |
| FR-LEAD-003 Lead status            | Done                                        | Transition map, actor/time recorded                                                  | U, I admin.test                               |
| FR-LEAD-004 Assignment             | Done                                        | Owner must be active business development user                                       | I admin.test                                  |
| FR-LEAD-005 Notes                  | Done                                        | Internal notes and follow-ups                                                        | I admin.test, E                               |
| FR-LEAD-006 Filtering and search   | Done                                        | Status, owner, service, date range, keyword                                          | I admin.test                                  |
| FR-LEAD-007 Export                 | Done                                        | Column choice, row cap, rate limit, formula escaping, audit                          | U, I admin.test                               |
| FR-LEAD-008 Retention/deletion     | Done                                        | Anonymise, delete, scheduled retention                                               | I admin.test                                  |
| FR-SEO-001 Metadata                | Done                                        | `lib/seo.ts`, per-route `generateMetadata`, OG image                                 | E public.spec                                 |
| FR-SEO-002 Sitemap and robots      | Done                                        | `app/sitemap.ts`, `app/robots.ts`                                                    | E public.spec                                 |
| FR-SEO-003 Structured data (Could) | Done                                        | Organization, Service, FAQPage JSON-LD from visible content                          | Manual validator check                        |
| FR-AN-001 Conversion analytics     | Done                                        | `lib/analytics/client.ts` events without personal data                               | U, E enquiry-admin.spec                       |
| FR-AN-002 Consent gating           | Done                                        | Consent modes, banner, preference link                                               | U security-utils                              |
| FR-OPS-001 Logging                 | Done                                        | JSON logger with redaction, request IDs                                              | U security-utils                              |
| FR-OPS-002 Health and alerting     | Done                                        | `/api/health`, ops alerts on dead notifications                                      | I enquiries.test                              |
| FR-OPS-003 Backup and restore      | Done (manual)                               | Runbook procedure                                                                    | Restore test record                           |
| FR-OPS-004 Environment separation  | Done                                        | Env validation, non-indexable non-production                                         | Configuration review                          |

## User requirements

| URS               | Covered by                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| URS-001, 003      | FR-HOME-001, FR-CORP-001/003, FR-SRV-002                                                               |
| URS-002, 004      | FR-SRV-001..004                                                                                        |
| URS-005, 006, 010 | FR-PORT-001..006, FR-SRV-005                                                                           |
| URS-007, 008, 009 | FR-ENQ-001..009, consent record                                                                        |
| URS-011, 012, 022 | FR-GEN-002/004, NFR-06/07/23; axe and mobile e2e tests                                                 |
| URS-013           | FR-SEO-001..003                                                                                        |
| URS-014, 019, 023 | FR-ADM-003..008, audit log, redirects                                                                  |
| URS-015, 024      | FR-LEAD-001..008, content guide                                                                        |
| URS-016           | FR-ADM-001/002/009/010                                                                                 |
| URS-017           | FR-OPS-001..004, outbox and alerts                                                                     |
| URS-018           | FR-AN-001/002, dashboard reporting                                                                     |
| URS-020           | Structured content model, isolated providers (`email/providers.ts`, `media/storage.ts`), versioned API |
| URS-021           | NFR-01..05 (server rendering, cached data, small client bundles)                                       |

## Non-functional requirements

| NFR                               | Approach                                                                                 | Evidence                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 01–02 Performance                 | Server-rendered pages, ~105 kB shared JS, self-hosted font, sized images, data cache     | Lighthouse and field data before launch (manual)            |
| 03 Availability                   | Stateless app, health checks, restart policies                                           | Uptime monitor                                              |
| 04 API response                   | Indexed queries, cached public reads                                                     | Load test before launch (manual)                            |
| 05 Scalability                    | Pagination everywhere, indexes, stateless web tier, DB-backed rate limits and job claims | Code review                                                 |
| 06 Accessibility                  | Semantic HTML, labels, error summary, focus management, skip links                       | axe scans in E; manual screen-reader check                  |
| 07, 22 Responsive/compat          | Mobile-first layouts                                                                     | E responsive.spec; browser matrix (manual)                  |
| 08 Security baseline              | OWASP-aligned controls listed in architecture.md                                         | Unit, integration and e2e security tests; `npm audit` in CI |
| 09 Transport/storage              | HSTS, secure cookies, encrypted TOTP secrets                                             | Configuration review                                        |
| 10 Auth/session                   | See architecture.md                                                                      | I admin.test                                                |
| 11 Authorisation                  | Server-side permission checks per action and record                                      | I admin/content tests, E (UAT-06)                           |
| 12 Input/output safety            | Zod validation, size limits, parameterised queries, escaped output, CSV escaping         | U, I tests                                                  |
| 13 Privacy/minimisation           | Configurable fields, minimal notifications, no PII in analytics or logs                  | I enquiries.test, U                                         |
| 14 Retention                      | Retention job and settings                                                               | I admin.test                                                |
| 15 Reliability                    | Transactional outbox, bounded retries                                                    | I enquiries.test (failure injection)                        |
| 16 Backup/recovery                | Runbook                                                                                  | Restore test (manual)                                       |
| 17 Maintainability                | Strict TypeScript, lint, format, layered modules                                         | CI                                                          |
| 18 Testability                    | 66 unit/integration tests, 17 e2e tests                                                  | CI                                                          |
| 19 Observability                  | Request IDs, structured logs, alerts                                                     | U, I                                                        |
| 20 SEO                            | Canonicals, sitemap, robots, noindex for private routes                                  | E public.spec                                               |
| 21 Content portability            | Content stored as validated JSON in PostgreSQL; documented schema                        | Data model                                                  |
| 23 Usability                      | Plain-language errors that keep entered data                                             | E enquiry-admin.spec                                        |
| 24 Supply chain                   | Lockfile, exact versions, approved install scripts, audit gate                           | CI                                                          |
| 25 Localisation readiness (Could) | Dates via `Intl` with configurable admin time zone; copy in CMS                          | Design review                                               |
| 26 Auditability                   | `AuditEvent` for sign-ins, publication, roles, exports, lead changes, deletions          | I tests, audit log page                                     |

## UAT scenarios

| UAT    | Automated coverage                                                      |
| ------ | ----------------------------------------------------------------------- |
| UAT-01 | E public.spec "home presents services…"                                 |
| UAT-02 | E public.spec "portfolio filters and reset"                             |
| UAT-03 | E enquiry-admin.spec "validation errors…", I enquiries.test             |
| UAT-04 | E enquiry-admin.spec "keyboard-only visitor…", I enquiries.test         |
| UAT-05 | I enquiries.test "keeps the enquiry when email fails…"                  |
| UAT-06 | E enquiry-admin.spec "admin area requires authentication", I admin.test |
| UAT-07 | I content.test "refuses to publish client evidence…"                    |
| UAT-08 | E enquiry-admin.spec "publisher edits…", I content.test                 |
| UAT-09 | E enquiry-admin.spec keyboard test, responsive.spec menu test           |
| UAT-10 | Manual (operations runbook restore test)                                |
