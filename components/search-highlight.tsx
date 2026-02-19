"use client";

type SearchHighlightProps = {
  text: string | number | null | undefined;
  query: string;
  highlightClassName?: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function SearchHighlight({ text, query, highlightClassName = "bg-yellow-200 text-inherit rounded-sm px-0.5" }: SearchHighlightProps) {
  const source = text == null ? "" : String(text);
  const normalizedQuery = query.trim();

  if (!source || !normalizedQuery) {
    return <>{source}</>;
  }

  const regex = new RegExp(`(${escapeRegExp(normalizedQuery)})`, "gi");
  const parts = source.split(regex);
  const lowerQuery = normalizedQuery.toLowerCase();

  return (
    <>
      {parts.map((part, index) => (
        part.toLowerCase() === lowerQuery
          ? <mark key={`${part}-${index}`} className={highlightClassName}>{part}</mark>
          : part
      ))}
    </>
  );
}
