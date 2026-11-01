import "server-only";
import { isAppError, type FieldErrors } from "./errors";
import { logger } from "./logger";
import { requestContext } from "./request-context";
import { requirePermission } from "./auth/guard";
import type { Permission } from "./auth/permissions";
import type { SessionUser } from "./auth/session";

export interface ActionState {
  ok?: boolean;
  message?: string;
  fieldErrors?: FieldErrors;
  /** Optional one-time data to show the user (e.g. an invite link). */
  data?: Record<string, string>;
  /** Incremented on every completion so clients can react to repeated identical results. */
  nonce?: number;
}

export interface ActionCtx {
  user: SessionUser;
  requestId: string;
}

/**
 * Wrap an admin server action: authenticate, authorise (server-side, every
 * call), run, and convert domain errors into form state. Unexpected errors are
 * logged with the request ID and shown as a generic message.
 */
export async function adminAction(
  permission: Permission | null,
  fn: (ctx: ActionCtx) => Promise<ActionState | string | void>,
): Promise<ActionState> {
  const { requestId } = await requestContext();
  try {
    const user = await requirePermission(permission ?? undefined);
    const result = await fn({ user, requestId });
    if (typeof result === "string") return { ok: true, message: result, nonce: Date.now() };
    return { ok: true, ...(result ?? {}), nonce: Date.now() };
  } catch (error) {
    // Let Next.js redirect / notFound signals propagate.
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest: unknown }).digest).startsWith("NEXT_")
    )
      throw error;
    if (isAppError(error))
      return {
        ok: false,
        message: error.message,
        fieldErrors: error.fieldErrors,
        nonce: Date.now(),
      };
    logger.error("admin.action_failed", { requestId, error });
    return {
      ok: false,
      message: `Something went wrong. Nothing was changed. (Reference ${requestId.slice(0, 8)})`,
      nonce: Date.now(),
    };
  }
}

export function fdString(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
}

export function fdOptional(fd: FormData, key: string): string | null {
  const v = fdString(fd, key).trim();
  return v ? v : null;
}

export function fdJson<T>(fd: FormData, key: string, fallback: T): T {
  const raw = fdString(fd, key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function fdLines(fd: FormData, key: string): string[] {
  return fdString(fd, key)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Map a Zod error into field errors keyed by the first path segment (or dotted path). */
export function zodToFieldErrors(issues: { path: PropertyKey[]; message: string }[]): FieldErrors {
  const out: FieldErrors = {};
  for (const i of issues) {
    const key = i.path.map(String).join(".") || "form";
    (out[key] ??= []).push(i.message);
  }
  return out;
}
