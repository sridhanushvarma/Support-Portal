import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/content/public";
import { SubmissionTracker } from "@/components/site/submission-tracker";

export const metadata: Metadata = {
  title: "Enquiry received",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ ref?: string }> };

export default async function ThankYouPage({ searchParams }: Props) {
  const { ref } = await searchParams;
  const settings = await getSettings();
  const reference = ref && /^ENQ-[A-Z0-9]{8}$/.test(ref) ? ref : null;
  return (
    <section className="container-page py-20">
      <SubmissionTracker />
      <div className="mx-auto max-w-2xl text-center">
        <div
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft"
        >
          <svg className="h-8 w-8 text-success" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.7 5.3a1 1 0 010 1.4l-8 8a1 1 0 01-1.4 0l-4-4a1 1 0 011.4-1.4L8 12.6l7.3-7.3a1 1 0 011.4 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-navy">
          Thank you, we have received your enquiry
        </h1>
        {reference && (
          <p className="mt-6 text-lg text-ink-soft">
            Your reference is <strong className="font-mono text-ink">{reference}</strong>. Please
            quote it if you contact us about this enquiry.
          </p>
        )}
        <p className="mt-4 text-lg text-ink-soft">{settings.responseExpectation}</p>
        {settings.enquiryAckEnabled && (
          <p className="mt-4 text-ink-soft">
            We have also sent a confirmation to the email address you provided.
          </p>
        )}
        <p className="mt-4 text-sm text-muted">
          This confirms receipt only. It is not a quotation or a commitment to deliver the project.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/projects" className="btn-secondary">
            Browse our projects
          </Link>
          <Link href="/" className="btn-primary">
            Return to the home page
          </Link>
        </div>
      </div>
    </section>
  );
}
