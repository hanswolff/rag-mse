import { getToken } from "next-auth/jwt";

jest.mock("next-auth/jwt", () => ({
  getToken: jest.fn(),
}));

// Lokaler next/server-Mock mit redirect()/next(), die der globale Setup-Fake
// nicht kennt — proxy() wird damit tatsächlich ausgeführt statt nur geparst.
jest.mock("next/server", () => ({
  NextResponse: {
    redirect: jest.fn((url: URL) => ({
      type: "redirect",
      url: url.toString(),
      headers: new Headers(),
    })),
    next: jest.fn((init?: { request?: { headers: Headers } }) => ({
      type: "next",
      requestHeaders: init?.request?.headers,
      headers: new Headers(),
    })),
  },
}));

import { proxy } from "@/proxy";

function makeRequest(pathname: string, search = "", headers: Record<string, string> = {}) {
  return {
    nextUrl: { pathname, search },
    url: `http://localhost:3000${pathname}${search}`,
    headers: new Headers(headers),
  } as never;
}

type ProxyResult = {
  type: string;
  url?: string;
  headers: Headers;
  requestHeaders?: Headers;
};

describe("proxy (auth middleware)", () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_SECRET = "test-secret-with-enough-characters!!";
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NEXTAUTH_SECRET = originalSecret;
    (console.error as jest.Mock).mockRestore();
  });

  it("redirects to login with returnUrl when unauthenticated on a protected path", async () => {
    (getToken as jest.Mock).mockResolvedValue(null);

    const result = (await proxy(makeRequest("/admin/termine", "?page=2"))) as unknown as { type: string; url: string };

    expect(result.type).toBe("redirect");
    expect(result.url).toContain("/login");
    expect(result.url).toContain(encodeURIComponent("/admin/termine?page=2"));
  });

  it("lets authenticated requests through", async () => {
    (getToken as jest.Mock).mockResolvedValue({ sub: "user-1" });

    const result = (await proxy(makeRequest("/admin/termine"))) as unknown as { type: string };

    expect(result.type).toBe("next");
  });

  it("blocks all protected access when NEXTAUTH_SECRET is missing", async () => {
    delete process.env.NEXTAUTH_SECRET;

    const result = (await proxy(makeRequest("/admin"))) as unknown as { type: string };

    expect(result.type).toBe("redirect");
    expect(getToken).not.toHaveBeenCalled();
  });

  it("redirects to login when reading the token throws", async () => {
    (getToken as jest.Mock).mockRejectedValue(new Error("jwt malformed"));

    const result = (await proxy(makeRequest("/profil"))) as unknown as { type: string };

    expect(result.type).toBe("redirect");
  });

  it("allows unauthenticated access to the unsubscribe path", async () => {
    (getToken as jest.Mock).mockResolvedValue(null);

    const result = (await proxy(makeRequest("/benachrichtigungen/abmelden/token123"))) as unknown as { type: string };

    expect(result.type).toBe("next");
  });

  it("does not read the auth token on public paths", async () => {
    const result = (await proxy(makeRequest("/termine"))) as unknown as ProxyResult;

    expect(result.type).toBe("next");
    expect(getToken).not.toHaveBeenCalled();
  });
});

describe("proxy (CSP nonce)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_SECRET = "test-secret-with-enough-characters!!";
    (getToken as jest.Mock).mockResolvedValue({ sub: "user-1" });
  });

  it("sends a report-only policy that carries the nonce", async () => {
    const result = (await proxy(makeRequest("/termine"))) as unknown as ProxyResult;

    const reportOnly = result.headers.get("Content-Security-Policy-Report-Only");
    expect(reportOnly).toContain("'nonce-");
    expect(reportOnly).toContain("'strict-dynamic'");
  });

  // Ohne diesen erzwingenden Gegenpart wäre die Umstellung schon scharf.
  it("does not send an enforcing policy from the proxy", async () => {
    const result = (await proxy(makeRequest("/termine"))) as unknown as ProxyResult;

    expect(result.headers.get("Content-Security-Policy")).toBeNull();
  });

  // Next liest die Nonce aus dem Request-Header und setzt sie an seine eigenen
  // Bootstrap-Skripte; ohne ihn blieben genau die Skripte ohne Nonce.
  it("passes the nonce to the request so Next can apply it", async () => {
    const result = (await proxy(makeRequest("/termine"))) as unknown as ProxyResult;

    const nonce = result.requestHeaders?.get("x-nonce");
    expect(nonce).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.requestHeaders?.get("Content-Security-Policy")).toContain(`'nonce-${nonce}'`);
    expect(result.headers.get("Content-Security-Policy-Report-Only")).toContain(`'nonce-${nonce}'`);
  });

  it("uses a fresh nonce per request", async () => {
    const first = (await proxy(makeRequest("/termine"))) as unknown as ProxyResult;
    const second = (await proxy(makeRequest("/termine"))) as unknown as ProxyResult;

    expect(first.requestHeaders?.get("x-nonce")).not.toBe(second.requestHeaders?.get("x-nonce"));
  });

  // Prefetch-HTML wird zwischengespeichert; eine dann abgelaufene Nonce darin
  // wäre wertlos. Der Auth-Schutz muss trotzdem greifen.
  it("omits the nonce for prefetch requests but still guards them", async () => {
    (getToken as jest.Mock).mockResolvedValue(null);

    const result = (await proxy(
      makeRequest("/admin", "", { "next-router-prefetch": "1" })
    )) as unknown as ProxyResult;

    expect(result.type).toBe("redirect");
    expect(result.headers.get("Content-Security-Policy-Report-Only")).toBeNull();
  });

  it("omits the nonce for purpose=prefetch requests", async () => {
    const result = (await proxy(
      makeRequest("/termine", "", { purpose: "prefetch" })
    )) as unknown as ProxyResult;

    expect(result.type).toBe("next");
    expect(result.headers.get("Content-Security-Policy-Report-Only")).toBeNull();
    expect(result.requestHeaders?.get("x-nonce")).toBeNull();
  });

  it("also sets the report-only policy on a login redirect", async () => {
    (getToken as jest.Mock).mockResolvedValue(null);

    const result = (await proxy(makeRequest("/admin"))) as unknown as ProxyResult;

    expect(result.type).toBe("redirect");
    expect(result.headers.get("Content-Security-Policy-Report-Only")).toContain("'nonce-");
  });
});
