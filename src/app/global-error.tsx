"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-GB">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          padding: "4rem 1.5rem",
          textAlign: "center",
          color: "#0b1f33",
        }}
      >
        <h1>Sorry, the site is temporarily unavailable</h1>
        <p>Please try again in a few minutes.</p>
        {error.digest && (
          <p style={{ fontFamily: "monospace", color: "#5b6b7b" }}>Reference: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "1.5rem",
            padding: "0.75rem 1.25rem",
            background: "#0f766e",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            fontSize: 16,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
