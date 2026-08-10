#!/usr/bin/env node

// HTTP-Smoke gegen den frisch gebauten Wegwerf-Container, BEVOR deploy.sh den
// Prod-Container ersetzt: "App bootet, aber Route 500t" soll vor dem Umschalten
// auffallen, nicht danach. Nur lesende Zugriffe gegen eine leere Wegwerf-DB.

const baseUrl = (process.argv[2] || "http://127.0.0.1:3000").replace(/\/$/, "");

const REQUEST_TIMEOUT_MS = 15000;

const PUBLIC_PAGES = ["/", "/termine", "/login", "/ausschreibungen", "/news"];
const ERROR_MARKERS = [
  "Application error: a client-side exception",
  "Internal Server Error",
];
// Nur Titel und Überschriften prüfen: Fehlerseiten tragen den Text dort, ein
// Inhaltstext (z. B. eine News-Meldung), der die Wendung zitiert, soll das
// Deployment nicht blockieren.
const HEADING_PATTERN = /<title[^>]*>([\s\S]*?)<\/title>|<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi;
const REQUIRED_SECURITY_HEADERS = [
  "content-security-policy",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
];
const PROTECTED_APIS = ["/api/user/profile", "/api/admin/users"];

const failures = [];

function recordFailure(url, expected, got) {
  failures.push(`  ❌ ${url}\n     erwartet: ${expected}\n     erhalten: ${got}`);
}

function pass(url, detail) {
  console.log(`  ✓ ${url} (${detail})`);
}

// Liest auch den Body noch innerhalb des Timeouts: ein Container, der nur die
// Header sendet und den Stream dann hängen lässt, darf das Deploy nicht
// unbegrenzt blockieren.
async function fetchWithTimeout(path, headers = {}) {
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers, redirect: "manual", signal: controller.signal });
    const text = await response.text();
    return { status: response.status, headers: response.headers, text };
  } finally {
    clearTimeout(timer);
  }
}

function findErrorMarker(html) {
  const headings = [];
  for (const match of html.matchAll(HEADING_PATTERN)) {
    headings.push(match[1] ?? match[2] ?? "");
  }
  const haystack = headings.join(" ");
  return ERROR_MARKERS.find((marker) => haystack.includes(marker)) || null;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function checkPublicPage(path) {
  const response = await fetchWithTimeout(path, { Accept: "text/html" });
  if (response.status !== 200) {
    recordFailure(path, "HTTP 200", `HTTP ${response.status}`);
    return;
  }
  const html = response.text;
  if (!html.toLowerCase().includes("<html")) {
    recordFailure(path, "HTML-Dokument", "Antwort ohne <html>");
    return;
  }
  const marker = findErrorMarker(html);
  if (marker) {
    recordFailure(path, "Seite ohne Fehler-Marker", `Titel/Überschrift enthält "${marker}"`);
    return;
  }
  pass(path, "200, HTML ohne Fehler-Marker");
}

async function checkSecurityHeaders() {
  const response = await fetchWithTimeout("/", { Accept: "text/html" });
  const missing = REQUIRED_SECURITY_HEADERS.filter((header) => !response.headers.get(header));
  if (missing.length > 0) {
    recordFailure("/", `Security-Header ${REQUIRED_SECURITY_HEADERS.join(", ")}`, `fehlend: ${missing.join(", ")}`);
    return;
  }
  pass("/", "alle Security-Header vorhanden");
}

async function checkPublicApis() {
  const health = await fetchWithTimeout("/api/health", { Accept: "application/json" });
  if (health.status !== 200) {
    recordFailure("/api/health", "HTTP 200", `HTTP ${health.status}`);
  } else {
    const body = parseJson(health.text);
    if (!body || body.status !== "ok") {
      recordFailure("/api/health", 'JSON mit status "ok"', JSON.stringify(body));
    } else {
      pass("/api/health", 'status "ok"');
    }
  }

  const events = await fetchWithTimeout("/api/events", { Accept: "application/json" });
  if (events.status !== 200) {
    recordFailure("/api/events", "HTTP 200", `HTTP ${events.status}`);
  } else {
    const body = parseJson(events.text);
    if (!body || !Array.isArray(body.events)) {
      recordFailure("/api/events", "JSON mit events-Array", JSON.stringify(body)?.slice(0, 200));
    } else {
      pass("/api/events", `events-Array (${body.events.length} Einträge)`);
    }
  }
}

async function checkUnknownRoute() {
  const path = "/diese-route-gibt-es-nicht";
  const response = await fetchWithTimeout(path, { Accept: "text/html" });
  if (response.status !== 404) {
    recordFailure(path, "HTTP 404", `HTTP ${response.status}`);
    return;
  }
  pass(path, "404");
}

async function checkProtectedApis() {
  for (const path of PROTECTED_APIS) {
    const response = await fetchWithTimeout(path, { Accept: "application/json" });
    if (response.status !== 401 && response.status !== 403) {
      recordFailure(path, "HTTP 401/403 ohne Session", `HTTP ${response.status}`);
      continue;
    }
    pass(path, `${response.status} ohne Session`);
  }
}

async function main() {
  console.log(`HTTP smoke check against ${baseUrl} ...`);

  for (const path of PUBLIC_PAGES) {
    await checkPublicPage(path);
  }
  await checkSecurityHeaders();
  await checkPublicApis();
  await checkUnknownRoute();
  await checkProtectedApis();

  if (failures.length > 0) {
    console.error(`\nHTTP smoke check failed (${failures.length} Problem(e)):`);
    for (const failure of failures) {
      console.error(failure);
    }
    process.exit(1);
  }

  console.log("HTTP smoke check passed.");
}

main().catch((error) => {
  console.error(`HTTP smoke check failed: ${error.message}`);
  process.exit(1);
});
