import { prisma, type Db } from "./db";
import { ValidationError } from "./errors";

const BLOCKED_PREFIXES = ["/admin", "/api", "/_next", "/media"];
const MAX_HOPS = 10;

/** Normalise and validate a site-relative path. Throws a ValidationError when unsafe. */
export function normalizePath(input: string, field = "path"): string {
  const raw = input.trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\"))
    throw ValidationError("Use a site-relative path starting with a single '/'.", {
      [field]: ["Use a site-relative path such as /old-page."],
    });
  if (/[?#\s\u0000-\u001F]/.test(raw))
    throw ValidationError("Paths cannot contain spaces, query strings or fragments.", {
      [field]: ["Remove spaces, '?' and '#'."],
    });
  if (raw.length > 300)
    throw ValidationError("Path too long.", { [field]: ["Use 300 characters or fewer."] });
  const path = raw.length > 1 ? raw.replace(/\/+$/, "") : raw;
  if (BLOCKED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`)))
    throw ValidationError("System paths cannot be redirected.", {
      [field]: ["System paths such as /admin and /api cannot be used."],
    });
  return path;
}

/** Follow redirects from a path; returns the final destination or throws on a loop. */
async function finalDestination(db: Db, start: string, forbidden: string): Promise<string> {
  let current = start;
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (current === forbidden)
      throw ValidationError("This redirect would create a loop.", {
        targetPath: ["This would create a redirect loop."],
      });
    const next = await db.redirect.findUnique({ where: { sourcePath: current } });
    if (!next || !next.enabled) return current;
    current = next.targetPath;
  }
  throw ValidationError("Redirect chain is too long.", {
    targetPath: ["The target already redirects through too many hops."],
  });
}

/**
 * Create or update a redirect. Chains are flattened (A→B, B→C becomes A→C) and
 * loops are rejected (UC-10). Existing redirects that pointed at `source` are
 * re-targeted so visitors never pass through more than one hop.
 */
export async function upsertRedirect(
  db: Db,
  input: { sourcePath: string; targetPath: string; statusCode?: number; createdBy?: string | null },
) {
  const source = normalizePath(input.sourcePath, "sourcePath");
  const target = normalizePath(input.targetPath, "targetPath");
  if (source === target)
    throw ValidationError("Source and target are the same.", {
      targetPath: ["Target must differ from the source."],
    });
  const destination = await finalDestination(db, target, source);
  const statusCode = input.statusCode ?? 308;
  const redirect = await db.redirect.upsert({
    where: { sourcePath: source },
    create: {
      sourcePath: source,
      targetPath: destination,
      statusCode,
      createdBy: input.createdBy ?? null,
    },
    update: { targetPath: destination, statusCode, enabled: true },
  });
  // Loops were rejected above, so re-targeting cannot create a self-redirect.
  await db.redirect.updateMany({
    where: { targetPath: source },
    data: { targetPath: destination },
  });
  return redirect;
}

/**
 * Called when content goes live at `newPath`. Live content always wins over a
 * redirect from the same path; a changed slug gets a permanent redirect from
 * the previous public path (FR-PORT-006).
 */
export async function onContentLive(
  db: Db,
  newPath: string,
  previousPath: string | null,
  actorId: string | null,
) {
  await db.redirect.deleteMany({ where: { sourcePath: newPath } });
  if (previousPath && previousPath !== newPath) {
    await upsertRedirect(db, {
      sourcePath: previousPath,
      targetPath: newPath,
      statusCode: 308,
      createdBy: actorId,
    });
  }
}

export async function resolveRedirect(
  path: string,
): Promise<{ targetPath: string; statusCode: number } | null> {
  let normalized: string;
  try {
    normalized = normalizePath(decodeURI(path));
  } catch {
    return null;
  }
  const r = await prisma.redirect.findUnique({ where: { sourcePath: normalized } });
  if (!r || !r.enabled) return null;
  return { targetPath: r.targetPath, statusCode: r.statusCode };
}
