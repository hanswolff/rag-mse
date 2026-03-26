import { buildHtmlFromText } from "@/lib/email/utils";

describe("buildHtmlFromText", () => {
  it("wraps content in HTML document with font styling", () => {
    const result = buildHtmlFromText("Hello World");

    expect(result).toContain("<!DOCTYPE html>");
    expect(result).toContain("font-family");
    expect(result).toContain("Hello World");
  });

  it("converts URLs to clickable links", () => {
    const result = buildHtmlFromText("Visit https://example.com/path for details");

    expect(result).toContain('<a href="https://example.com/path"');
    expect(result).toContain('style="color: #2563eb; text-decoration: underline;"');
    expect(result).toContain(">https://example.com/path</a>");
  });

  it("handles URLs with query parameters", () => {
    const result = buildHtmlFromText("Link: https://example.com?a=1&b=2");

    expect(result).toContain('<a href="https://example.com?a=1&amp;b=2"');
    expect(result).toContain(">https://example.com?a=1&amp;b=2</a>");
  });

  it("converts newlines to br tags", () => {
    const result = buildHtmlFromText("Line1\nLine2");

    expect(result).toContain("Line1<br />Line2");
  });

  it("escapes HTML special characters", () => {
    const result = buildHtmlFromText("Hello <World> & 'Friends'");

    expect(result).toContain("&lt;World&gt;");
    expect(result).toContain("&amp;");
    expect(result).toContain("&#39;");
  });

  it("handles text with multiple URLs", () => {
    const result = buildHtmlFromText(
      "First: https://example.com\nSecond: https://other.org/page",
    );

    const linkMatches = result.match(/<a href="/g);
    expect(linkMatches).toHaveLength(2);
    expect(result).toContain('<a href="https://example.com"');
    expect(result).toContain('<a href="https://other.org/page"');
  });
});
