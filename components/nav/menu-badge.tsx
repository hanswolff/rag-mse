// Einheitliches Zähler-Badge für Navigationseinträge (offene Umfragen, aktive
// Ausschreibungen). Bei 0 wird bewusst nichts gerendert, damit ein leerer Zähler
// keinen optischen Platz belegt.
export function MenuBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) {
    return null;
  }

  return (
    <span
      className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-brand-red-600 text-white"
      aria-label={`${count} ${label}`}
    >
      {count}
    </span>
  );
}
