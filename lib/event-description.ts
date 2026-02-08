import sanitizeHtml from "sanitize-html";

export const MAX_EVENT_DESCRIPTION_BYTES = 1024 * 1024;

const EVENT_DESCRIPTION_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "a", "blockquote"],
  allowedAttributes: {
    a: ["href", "target", "rel"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  enforceHtmlBoundary: true,
  transformTags: {
    a: (_tagName, attribs) => ({
      tagName: "a",
      attribs: {
        ...attribs,
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      },
    }),
  },
};

const STRIP_ALL_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
};

export function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function isEventDescriptionWithinLimit(value: string): boolean {
  return getUtf8ByteLength(value) <= MAX_EVENT_DESCRIPTION_BYTES;
}

export function sanitizeEventDescriptionHtml(value: string): string {
  const normalized = typeof value === "string" ? value.replace(/\r\n?/g, "\n") : "";
  return sanitizeHtml(normalized, EVENT_DESCRIPTION_SANITIZE_OPTIONS).trim();
}

export function stripEventDescriptionText(value: string): string {
  const normalized = typeof value === "string" ? value : "";
  return sanitizeHtml(normalized, STRIP_ALL_HTML_OPTIONS)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (entity, content) => {
    const named: Record<string, string> = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
      nbsp: " ",
    };

    const lower = content.toLowerCase();
    if (named[lower]) {
      return named[lower];
    }

    if (lower.startsWith("#x")) {
      const codePoint = Number.parseInt(lower.slice(2), 16);
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
    }

    if (lower.startsWith("#")) {
      const codePoint = Number.parseInt(lower.slice(1), 10);
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
    }

    return entity;
  });
}

export function hasEventDescriptionContent(value: string): boolean {
  return stripEventDescriptionText(value).length > 0;
}

export function formatEventDescriptionForDisplay(value: string): string {
  const normalized = typeof value === "string" ? value.replace(/\r\n?/g, "\n") : "";

  if (/<\/?[a-z][\s\S]*>/i.test(normalized)) {
    return sanitizeEventDescriptionHtml(normalized);
  }

  const escapedText = sanitizeHtml(normalized, STRIP_ALL_HTML_OPTIONS);
  return escapedText.replace(/\n/g, "<br />");
}

export function getEventDescriptionPreview(value: string, maxChars = 180): string {
  const plain = decodeHtmlEntities(stripEventDescriptionText(value));

  if (plain.length <= maxChars) {
    return plain;
  }

  return `${plain.slice(0, maxChars - 1).trimEnd()}…`;
}
