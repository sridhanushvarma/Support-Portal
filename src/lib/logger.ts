/**
 * Minimal structured JSON logger (FR-OPS-001, NFR-19).
 * Known sensitive keys are redacted so that enquiry content, credentials and
 * contact details never reach log storage by accident.
 */
type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const REDACT_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "secret",
  "authorization",
  "cookie",
  "email",
  "phone",
  "name",
  "projectsummary",
  "brief",
  "body",
  "message",
  "mfacode",
  "code",
]);

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel: Level =
  (process.env.LOG_LEVEL as Level) || (process.env.NODE_ENV === "test" ? "warn" : "info");

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) {
    return {
      type: value.name,
      message: value.message,
      stack: process.env.NODE_ENV === "production" ? undefined : value.stack,
    };
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? "[redacted]" : redact(v, depth + 1);
  }
  return out;
}

function write(level: Level, msg: string, fields?: Fields) {
  if (LEVELS[level] < LEVELS[minLevel]) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(fields ? (redact(fields) as Fields) : {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, fields?: Fields) => write("debug", msg, fields),
  info: (msg: string, fields?: Fields) => write("info", msg, fields),
  warn: (msg: string, fields?: Fields) => write("warn", msg, fields),
  error: (msg: string, fields?: Fields) => write("error", msg, fields),
};

export const __test = { redact };
