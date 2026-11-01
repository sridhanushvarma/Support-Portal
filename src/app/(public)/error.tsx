"use client";

import Link from "next/link";

/** Route-level error state: plain-language recovery, no internal details (URS-022). */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="container-page py-24 text-center">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-navy">
        This page could not be loaded
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-ink-soft">
        This is a problem on our side. Please try again. If it keeps happening, contact us and quote
        the reference below.
      </p>
      {error.digest && (
        <p className="mt-3 font-mono text-sm text-muted">Reference: {error.digest}</p>
      )}
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
        <Link href="/" className="btn-secondary">
          Go to the home page
        </Link>
      </div>
    </section>
  );
}
