import { getSettings } from "@/lib/content/public";
import { AnalyticsConsent } from "./analytics";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { UtmCapture } from "./utm-capture";

export async function PublicShell({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
      <SiteFooter />
      <AnalyticsConsent mode={settings.analyticsConsentMode} />
      <UtmCapture />
    </>
  );
}
