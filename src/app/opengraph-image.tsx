import { ImageResponse } from "next/og";
import { loadSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const alt = "Company logo and tagline";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default social-sharing image generated from the organisation name and tagline. */
export default async function OgImage() {
  const settings = await loadSettings().catch(() => null);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: "linear-gradient(135deg, #0f2a43 0%, #115e59 100%)",
        color: "white",
      }}
    >
      <div style={{ fontSize: 40, fontWeight: 700, color: "#5eead4" }}>
        {settings?.siteName ?? "Technology partner"}
      </div>
      <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.15, maxWidth: 1000 }}>
        {settings?.tagline ?? ""}
      </div>
      <div style={{ fontSize: 28, color: "#cbd5e1" }}>
        ERP · Custom software · Web · Data · AI automation
      </div>
    </div>,
    size,
  );
}
