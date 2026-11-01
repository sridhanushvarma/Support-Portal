import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import "@fontsource-variable/inter";
import "./globals.css";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/content/public";

export async function generateMetadata(): Promise<Metadata> {
  await connection(); // settings are read per request, never at build time
  const settings = await getSettings();
  const e = env();
  return {
    metadataBase: new URL(e.SITE_URL),
    title: { default: `${settings.siteName}`, template: `%s | ${settings.siteName}` },
    description: settings.tagline,
    applicationName: settings.siteName,
    robots: e.SITE_INDEXABLE ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { type: "website", siteName: settings.siteName, locale: "en_GB" },
    twitter: { card: "summary_large_image" },
    formatDetection: { telephone: false, email: false, address: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#0f2a43",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
