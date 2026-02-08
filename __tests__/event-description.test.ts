import {
  MAX_EVENT_DESCRIPTION_BYTES,
  formatEventDescriptionForDisplay,
  getEventDescriptionPreview,
  hasEventDescriptionContent,
  isEventDescriptionWithinLimit,
  sanitizeEventDescriptionHtml,
  stripEventDescriptionText,
} from "@/lib/event-description";

describe("event-description", () => {
  it("sanitizes disallowed tags", () => {
    const value = '<p>Hallo</p><script>alert("x")</script>';

    const sanitized = sanitizeEventDescriptionHtml(value);

    expect(sanitized).toContain("<p>Hallo</p>");
    expect(sanitized).not.toContain("<script>");
  });

  it("preserves allowed formatting tags", () => {
    const value = "<p><strong>Fett</strong> und <em>Kursiv</em></p>";

    const sanitized = sanitizeEventDescriptionHtml(value);

    expect(sanitized).toContain("<strong>Fett</strong>");
    expect(sanitized).toContain("<em>Kursiv</em>");
  });

  it("returns false for content without visible text", () => {
    expect(hasEventDescriptionContent("<p><br></p>")).toBe(false);
  });

  it("strips html to plain text", () => {
    const text = stripEventDescriptionText("<p>Alpha</p><p>Beta</p>");

    expect(text).toContain("Alpha");
    expect(text).toContain("Beta");
  });

  it("checks byte limit", () => {
    expect(isEventDescriptionWithinLimit("a".repeat(MAX_EVENT_DESCRIPTION_BYTES))).toBe(true);
    expect(isEventDescriptionWithinLimit("a".repeat(MAX_EVENT_DESCRIPTION_BYTES + 1))).toBe(false);
  });

  it("formats plain text with line breaks for display", () => {
    const html = formatEventDescriptionForDisplay("Zeile 1\nZeile 2");

    expect(html).toContain("Zeile 1<br />Zeile 2");
  });

  it("creates shortened preview", () => {
    const preview = getEventDescriptionPreview("A".repeat(30), 10);

    expect(preview).toHaveLength(10);
    expect(preview.endsWith("…")).toBe(true);
  });

  it("decodes html entities in preview text", () => {
    const preview = getEventDescriptionPreview("Treffen &amp; Training &#39;Alpha&#39;", 100);

    expect(preview).toBe("Treffen & Training 'Alpha'");
  });
});
