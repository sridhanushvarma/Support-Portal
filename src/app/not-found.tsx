import Link from "next/link";
import { connection } from "next/server";
import { PublicShell } from "@/components/site/public-shell";

export const metadata = { title: "Page not found", robots: { index: false } };

export default async function NotFound() {
  // Render per request: the header and footer read live settings, and builds must not need the database.
  await connection();
  return (
    <PublicShell>
      <section className="container-page py-24 text-center">
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-navy">
          We could not find that page
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-ink-soft">
          The page may have moved or no longer exists. Try one of these instead.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/" className="btn-primary">
            Home
          </Link>
          <Link href="/services" className="btn-secondary">
            Services
          </Link>
          <Link href="/projects" className="btn-secondary">
            Projects
          </Link>
          <Link href="/contact" className="btn-secondary">
            Contact us
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
