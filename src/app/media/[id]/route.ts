import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";
import { mediaStorage } from "@/lib/media/storage";

/**
 * Serves stored images. Assets referenced by live content are public and
 * cacheable; anything else (drafts, unused uploads) requires an editor
 * session (NFR-11) and is never cached publicly.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new Response("Not found", { status: 404 });
  const asset = await prisma.mediaAsset.findUnique({ where: { id } });
  if (!asset) return new Response("Not found", { status: 404 });

  // `id` is a validated UUID, so the LIKE pattern cannot contain wildcards from user input.
  const live = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*)::bigint AS n FROM "Project"
    WHERE "publishedSlug" IS NOT NULL AND "published"::text LIKE ${`%${id}%`}`;
  const isPublic = Number(live[0]?.n ?? 0) > 0;
  if (!isPublic) {
    const session = await getCurrentSession();
    if (!session || session.mfaPending || !session.user.permissions.has("media.upload")) {
      return new Response("Not found", { status: 404 });
    }
  }
  const data = await mediaStorage().get(asset.storageKey);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(data.length),
      "Cache-Control": isPublic
        ? "public, max-age=86400, stale-while-revalidate=604800"
        : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Content-Disposition": "inline",
    },
  });
}
