"use client";

import Link from "next/link";
import { track } from "@/lib/analytics/client";

export function TrackedLink({
  href,
  className,
  children,
  location,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  location: string;
}) {
  return (
    <Link href={href} className={className} onClick={() => track("cta_click", { location })}>
      {children}
    </Link>
  );
}
