import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth/guard";
import { loadSettings } from "@/lib/settings";
import { AdminForm, Checkbox, Field, Select, SubmitButton } from "@/components/admin/form";
import { PageHeader, Panel } from "@/components/admin/ui";
import { saveSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Site settings" };

const MODES = [
  { value: "off", label: "Hidden" },
  { value: "optional", label: "Optional" },
  { value: "required", label: "Required" },
];

export default async function SettingsPage() {
  await requireAdminPage("settings.manage");
  const s = await loadSettings();
  return (
    <>
      <PageHeader
        title="Site settings"
        description="Organisation details, enquiry handling, privacy and data retention. Secrets such as API keys are managed in the hosting environment, not here."
      />
      <AdminForm action={saveSettingsAction}>
        <Panel title="Organisation">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="siteName"
              label="Organisation name"
              required
              defaultValue={s.siteName}
              maxLength={80}
            />
            <Field
              name="legalName"
              label="Legal entity name"
              defaultValue={s.legalName}
              maxLength={160}
              hint="Used in the copyright line and structured data."
            />
            <div className="sm:col-span-2">
              <Field
                name="tagline"
                label="Positioning statement"
                defaultValue={s.tagline}
                maxLength={160}
              />
            </div>
            <Field
              name="contactEmail"
              label="Public contact email"
              type="email"
              defaultValue={s.contactEmail}
            />
            <Field
              name="contactPhone"
              label="Public phone"
              defaultValue={s.contactPhone}
              maxLength={40}
            />
            <Field
              name="contactAddress"
              label="Address"
              rows={3}
              defaultValue={s.contactAddress}
              maxLength={400}
            />
            <Field
              name="businessHours"
              label="Business hours"
              defaultValue={s.businessHours}
              maxLength={120}
            />
            <Field
              name="linkedinUrl"
              label="LinkedIn URL"
              type="url"
              defaultValue={s.linkedinUrl}
            />
            <Field name="githubUrl" label="GitHub URL" type="url" defaultValue={s.githubUrl} />
          </div>
        </Panel>
        <Panel title="Calls to action">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="primaryCtaLabel"
              label="Primary button label"
              required
              defaultValue={s.primaryCtaLabel}
              maxLength={40}
            />
            <Field
              name="secondaryCtaLabel"
              label="Secondary button label"
              required
              defaultValue={s.secondaryCtaLabel}
              maxLength={40}
            />
          </div>
        </Panel>
        <Panel title="Enquiries">
          <div className="grid gap-4">
            <Field
              name="enquiryRecipients"
              label="Team notification recipients"
              rows={3}
              defaultValue={s.enquiryRecipients.join("\n")}
              hint="One email per line. Notifications contain only the reference, service interest and a sign-in link."
            />
            <Checkbox
              name="enquiryAckEnabled"
              label="Send an acknowledgement email to the person who submitted the enquiry"
              defaultChecked={s.enquiryAckEnabled}
            />
            <Field
              name="responseExpectation"
              label="Response expectation"
              rows={2}
              defaultValue={s.responseExpectation}
              maxLength={240}
              hint="Shown on the contact page, confirmation page and acknowledgement email. Avoid promises you cannot keep."
            />
            <div className="grid gap-4 sm:grid-cols-4">
              <Select
                name="formPhone"
                label="Phone field"
                options={MODES}
                defaultValue={s.formPhone}
              />
              <Select
                name="formCountry"
                label="Country field"
                options={MODES}
                defaultValue={s.formCountry}
              />
              <Select
                name="formTimeline"
                label="Timeline field"
                options={MODES}
                defaultValue={s.formTimeline}
              />
              <Select
                name="formBudget"
                label="Budget field"
                options={MODES}
                defaultValue={s.formBudget}
              />
            </div>
            <p className="text-sm text-muted">
              Collect only what you need to qualify and respond. Each optional field should have a
              clear business reason.
            </p>
          </div>
        </Panel>
        <Panel title="Privacy and data retention">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="privacyPolicyVersion"
              label="Privacy notice version"
              required
              defaultValue={s.privacyPolicyVersion}
              maxLength={40}
              hint="Recorded with each enquiry's acknowledgement, e.g. 2026-11."
            />
            <Select
              name="analyticsConsentMode"
              label="Analytics consent"
              defaultValue={s.analyticsConsentMode}
              hint="Choose according to the advice for your jurisdictions."
              options={[
                { value: "opt-in", label: "Ask for consent first (opt-in)" },
                { value: "notice-only", label: "Notice only, with opt-out" },
                { value: "disabled", label: "Analytics disabled" },
              ]}
            />
            <Field
              name="enquiryRetentionDays"
              label="Anonymise closed enquiries after (days)"
              type="number"
              required
              defaultValue={s.enquiryRetentionDays}
              hint="Applies to Won, Lost, Not qualified and Closed enquiries with no activity for this period."
            />
            <Field
              name="contentReviewDays"
              label="Content review interval (days)"
              type="number"
              required
              defaultValue={s.contentReviewDays}
            />
            <Field
              name="adminTimeZone"
              label="Admin time zone"
              required
              defaultValue={s.adminTimeZone}
              hint="IANA name, e.g. Europe/London. Data is stored in UTC."
            />
            <div className="sm:col-span-2">
              <Checkbox
                name="privacyApproved"
                label="The published privacy notice has been approved by our privacy or legal adviser"
                defaultChecked={s.privacyApproved}
              />
            </div>
          </div>
        </Panel>
        <div className="sticky bottom-0 z-10 border-t border-line bg-surface/95 py-3 backdrop-blur">
          <SubmitButton>Save settings</SubmitButton>
        </div>
      </AdminForm>
    </>
  );
}
