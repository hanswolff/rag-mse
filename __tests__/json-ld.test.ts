import { serializeJsonLd } from "@/lib/json-ld";

describe("serializeJsonLd", () => {
  it("cannot break out of the script context with a </script> payload", () => {
    const payload = {
      "@type": "NewsArticle",
      headline: '</script><script>alert("xss")</script>',
      description: "harmlos <b>fett</b> & mehr",
    };

    const serialized = serializeJsonLd(payload);

    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain(">");
    expect(serialized).not.toContain("&");
    expect(serialized.toLowerCase()).not.toContain("</script");
  });

  it("stays valid JSON that round-trips to the original value", () => {
    const payload = {
      headline: '</script><script src="https://evil.example/x.js"></script>',
      text: "Zeilentrenner und Absatztrenner im Text",
    };

    expect(JSON.parse(serializeJsonLd(payload))).toEqual(payload);
  });

  it("escapes line and paragraph separators for inline-script safety", () => {
    const serialized = serializeJsonLd({ text: "a b c" });

    expect(serialized).toContain("\\u2028");
    expect(serialized).toContain("\\u2029");
    expect(serialized).not.toContain(" ");
    expect(serialized).not.toContain(" ");
  });
});
