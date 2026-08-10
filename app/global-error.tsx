"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "4rem 1rem" }}>
        <h1>Es ist ein Fehler aufgetreten</h1>
        <p>Die Seite konnte nicht geladen werden. Bitte versuchen Sie es erneut.</p>
        <button type="button" onClick={reset} style={{ padding: "0.5rem 1.5rem", cursor: "pointer" }}>
          Erneut versuchen
        </button>
      </body>
    </html>
  );
}
