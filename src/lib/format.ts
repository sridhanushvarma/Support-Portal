/** Render a UTC timestamp in the configured locale/time zone (BR-14). */
export function formatDateTime(
  date: Date | string | null | undefined,
  timeZone = "UTC",
  locale = "en-GB",
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(d);
}

export function formatDate(
  date: Date | string | null | undefined,
  timeZone = "UTC",
  locale = "en-GB",
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(d);
}

export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Split plain text into paragraphs on blank lines. Content is always rendered as text, never HTML. */
export function paragraphs(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
