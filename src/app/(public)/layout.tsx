import { PublicShell } from "@/components/site/public-shell";

// Content is read from the database at request time through a tag-invalidated
// data cache, so builds never need database access and publishes appear at once.
export const dynamic = "force-dynamic";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
