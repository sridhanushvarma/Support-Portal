# Go-live checklist

Audience: product owner, technical owner and business sign-off holders. Based on spec section 13.2 and Appendix B.
Items marked **(dashboard)** are checked automatically in Admin → Dashboard → Launch readiness.

## Content and claims

- [ ] Organisation name, legal name, positioning statement and CTA wording approved (dashboard: name)
- [ ] All five service pages reviewed and approved by service owners; no square-bracket placeholders remain
- [ ] About and Approach pages contain approved story, mission, vision and values (dashboard: About live)
- [ ] At least the agreed number of case studies published with evidence approval recorded (dashboard)
- [ ] Every image has meaningful alternative text and publishing rights
- [ ] Public contact email, phone and address are correct; no placeholder contacts (dashboard: contact email)

## Privacy and legal

- [ ] Privacy notice wording approved by the privacy or legal adviser, published, version set and marked approved (dashboard)
- [ ] Analytics consent mode chosen for the target jurisdictions; banner behaviour verified
- [ ] Enquiry retention period, audit retention and backup expiry agreed and configured
- [ ] Hosting region, email provider and subprocessors reviewed; data processing agreements signed

## Platform

- [ ] Domain, DNS and HTTPS certificate in place; `SITE_URL` uses HTTPS (dashboard)
- [ ] Secrets set in the secret manager; `APP_ENV=production`; `SITE_INDEXABLE=true` in production only
- [ ] Reverse proxy sets `X-Forwarded-For` and `TRUST_PROXY=true` (dashboard)
- [ ] SMTP provider configured with SPF, DKIM and DMARC; test email delivered (dashboard: provider)
- [ ] Enquiry notification recipients and `OPS_ALERT_EMAIL` set (dashboard)
- [ ] Worker running (or `/api/internal/jobs` scheduled)
- [ ] Database backups enabled; restore test completed and recorded (see operations runbook)
- [ ] Uptime monitoring on `/api/health?ready=1` with alert routing verified
- [ ] Log shipping in place; sample logs reviewed for personal data

## Access

- [ ] At least two administrators, all staff enrolled in MFA, `ADMIN_MFA_REQUIRED=true` (dashboard)
- [ ] Role matrix reviewed; leavers process agreed (deactivate account)

## Quality

- [ ] CI green: audit, lint, typecheck, unit, integration and end-to-end tests
- [ ] Manual accessibility review with keyboard and a screen reader on key routes; no critical blockers
- [ ] Browser and device matrix tested (Chrome, Edge, Firefox, Safari, iOS Safari, Android Chrome)
- [ ] Lighthouse run on key routes against NFR-01/02 targets; outliers fixed or accepted
- [ ] Sitemap, robots, canonical URLs and redirects from any previous website verified
- [ ] UAT scenarios UAT-01 to UAT-10 executed and signed by the business owner
- [ ] Critical and high-severity defects closed or risk-accepted in writing

## Sign-off

- [ ] Business owner: UAT and content approval
- [ ] Technical owner: operational readiness
