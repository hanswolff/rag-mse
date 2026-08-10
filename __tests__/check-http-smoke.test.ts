import { spawn } from "child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "http";
import type { AddressInfo } from "net";
import { readFileSync } from "fs";
import { join } from "path";

const SCRIPT_PATH = join(__dirname, "../scripts/check-http-smoke.js");

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": "default-src 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

function startServer(handler: Handler): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function stopServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

interface SmokeScriptResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

// Bewusst asynchrones spawn: spawnSync würde den Event-Loop blockieren und
// damit den im Testprozess laufenden HTTP-Server lahmlegen.
function runSmokeScript(server: Server): Promise<SmokeScriptResult> {
  const { port } = server.address() as AddressInfo;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT_PATH, `http://127.0.0.1:${port}`], {
      timeout: 60000,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

const PUBLIC_PAGES = ["/", "/termine", "/login", "/ausschreibungen", "/news"];
const PROTECTED_APIS = ["/api/user/profile", "/api/admin/users"];

function healthyAppHandler(req: IncomingMessage, res: ServerResponse): void {
  const path = (req.url || "/").split("?")[0];

  if (PUBLIC_PAGES.includes(path)) {
    res.writeHead(200, { "Content-Type": "text/html", ...SECURITY_HEADERS });
    res.end("<html><body>RAG Schießsport MSE</body></html>");
    return;
  }
  if (path === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (path === "/api/events") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ events: [], pastEvents: [] }));
    return;
  }
  if (PROTECTED_APIS.includes(path)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Nicht autorisiert" }));
    return;
  }
  res.writeHead(404, { "Content-Type": "text/html", ...SECURITY_HEADERS });
  res.end("<html><body>404</body></html>");
}

describe("scripts/check-http-smoke.js", () => {
  it("meldet Erfolg gegen eine gesunde App", async () => {
    const server = await startServer(healthyAppHandler);
    try {
      const result = await runSmokeScript(server);
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("HTTP smoke check passed.");
    } finally {
      await stopServer(server);
    }
  });

  it("scheitert, wenn eine öffentliche Seite 500 liefert", async () => {
    const server = await startServer((req, res) => {
      const path = (req.url || "/").split("?")[0];
      if (path === "/termine") {
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end("<html><body>Internal Server Error</body></html>");
        return;
      }
      healthyAppHandler(req, res);
    });
    try {
      const result = await runSmokeScript(server);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("/termine");
      expect(result.stderr).toContain("HTTP 500");
    } finally {
      await stopServer(server);
    }
  });

  it("scheitert bei fehlenden Security-Headern", async () => {
    const server = await startServer((req, res) => {
      const path = (req.url || "/").split("?")[0];
      if (PUBLIC_PAGES.includes(path)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body>ohne Header</body></html>");
        return;
      }
      healthyAppHandler(req, res);
    });
    try {
      const result = await runSmokeScript(server);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("content-security-policy");
    } finally {
      await stopServer(server);
    }
  });

  it("scheitert, wenn eine unbekannte Route nicht 404 liefert", async () => {
    const server = await startServer((req, res) => {
      const path = (req.url || "/").split("?")[0];
      if (path === "/diese-route-gibt-es-nicht") {
        res.writeHead(200, { "Content-Type": "text/html", ...SECURITY_HEADERS });
        res.end("<html><body>catch-all</body></html>");
        return;
      }
      healthyAppHandler(req, res);
    });
    try {
      const result = await runSmokeScript(server);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("/diese-route-gibt-es-nicht");
      expect(result.stderr).toContain("HTTP 404");
    } finally {
      await stopServer(server);
    }
  });

  it("scheitert bei einer Fehlerseite mit Fehler-Marker trotz HTTP 200", async () => {
    const server = await startServer((req, res) => {
      const path = (req.url || "/").split("?")[0];
      if (path === "/news") {
        res.writeHead(200, { "Content-Type": "text/html", ...SECURITY_HEADERS });
        res.end(
          "<html><head><title>Fehler</title></head><body>" +
            "<h2>Application error: a client-side exception has occurred</h2>" +
            "</body></html>"
        );
        return;
      }
      healthyAppHandler(req, res);
    });
    try {
      const result = await runSmokeScript(server);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("/news");
      expect(result.stderr).toContain("Application error");
    } finally {
      await stopServer(server);
    }
  });

  it("blockiert nicht, wenn ein Inhaltstext die Fehler-Wendung nur zitiert", async () => {
    const server = await startServer((req, res) => {
      const path = (req.url || "/").split("?")[0];
      if (path === "/news") {
        res.writeHead(200, { "Content-Type": "text/html", ...SECURITY_HEADERS });
        res.end(
          "<html><head><title>Neuigkeiten</title></head><body>" +
            "<h1>Neuigkeiten</h1>" +
            "<p>Am Wochenende meldete die Seite kurzzeitig Internal Server Error.</p>" +
            "</body></html>"
        );
        return;
      }
      healthyAppHandler(req, res);
    });
    try {
      const result = await runSmokeScript(server);
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
    } finally {
      await stopServer(server);
    }
  });

  it("scheitert, wenn eine öffentliche Seite auf einen Redirect läuft", async () => {
    const server = await startServer((req, res) => {
      const path = (req.url || "/").split("?")[0];
      if (path === "/ausschreibungen") {
        res.writeHead(308, { Location: "/anderswo" });
        res.end();
        return;
      }
      healthyAppHandler(req, res);
    });
    try {
      const result = await runSmokeScript(server);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("/ausschreibungen");
      expect(result.stderr).toContain("HTTP 308");
    } finally {
      await stopServer(server);
    }
  });

  it("scheitert, wenn /api/health mit 200 aber ohne JSON antwortet", async () => {
    const server = await startServer((req, res) => {
      const path = (req.url || "/").split("?")[0];
      if (path === "/api/health") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body>Proxy-Fehlerseite</body></html>");
        return;
      }
      healthyAppHandler(req, res);
    });
    try {
      const result = await runSmokeScript(server);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("/api/health");
    } finally {
      await stopServer(server);
    }
  });

  it("bricht ab, statt bei hängendem Antwort-Body ewig zu warten", async () => {
    // Header gesendet, Body offen: ohne Timeout um den Body-Read würde das
    // Skript – und damit deploy.sh – unbegrenzt hängen.
    const openResponses: ServerResponse[] = [];
    const server = await startServer((req, res) => {
      const path = (req.url || "/").split("?")[0];
      if (path === "/termine") {
        res.writeHead(200, { "Content-Type": "text/html", ...SECURITY_HEADERS });
        res.write("<html><body>");
        openResponses.push(res);
        return;
      }
      healthyAppHandler(req, res);
    });
    try {
      const result = await runSmokeScript(server);
      expect(result.status).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toMatch(/abort|timeout|failed/i);
    } finally {
      for (const res of openResponses) {
        res.destroy();
      }
      await stopServer(server);
    }
  }, 60000);

  it("scheitert, wenn eine geschützte API ohne Session 500 statt 401 liefert", async () => {
    const server = await startServer((req, res) => {
      const path = (req.url || "/").split("?")[0];
      if (path === "/api/admin/users") {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "kaputt" }));
        return;
      }
      healthyAppHandler(req, res);
    });
    try {
      const result = await runSmokeScript(server);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("/api/admin/users");
      expect(result.stderr).toContain("HTTP 401/403");
    } finally {
      await stopServer(server);
    }
  });
});

describe("deploy.sh pre-switch HTTP smoke gate", () => {
  const deployScript = readFileSync(join(__dirname, "../deploy.sh"), "utf-8");

  it("läuft nach dem Image-Build und vor dem Pre-Deploy-Backup/Umschalten", () => {
    const buildIndex = deployScript.indexOf("podman-compose build app");
    const smokeIndex = deployScript.indexOf("if ! run_pre_switch_http_smoke");
    const backupIndex = deployScript.indexOf("Creating pre-deploy database backup");
    // "force-recreate" kommt zuerst in rollback_deployment() vor — der
    // eindeutige Log-Text markiert das echte Umschalten.
    const recreateIndex = deployScript.indexOf("Recreating app container with latest image");

    expect(buildIndex).toBeGreaterThan(-1);
    expect(smokeIndex).toBeGreaterThan(buildIndex);
    expect(backupIndex).toBeGreaterThan(smokeIndex);
    expect(recreateIndex).toBeGreaterThan(smokeIndex);
  });

  it("nutzt Wegwerf-DB, Wegwerf-Namen und zufälligen Port statt Prod-Ressourcen", () => {
    expect(deployScript).toContain('DATABASE_URL="file:/app/data/smoke.db"');
    expect(deployScript).toContain('SMOKE_CONTAINER_NAME="rag-mse-smoke-$$"');
    // Zufälliger freier Host-Port statt Prod-Port 3000:
    expect(deployScript).toContain('-p "127.0.0.1::3000"');
    expect(deployScript).toContain("rag-mse-smoke-data-");
  });

  // Nur der Fehlerzweig des Smoke-Gates: begrenzt durch das "fi" am Zeilenanfang,
  // damit verschachtelte Blöcke drin bleiben, Nachbar-Gates aber draußen.
  const smokeFailureBlock = (() => {
    const start = deployScript.indexOf("if ! run_pre_switch_http_smoke; then");
    const end = deployScript.indexOf("\nfi\n", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return deployScript.slice(start, end);
  })();

  it("bricht das Deployment ab, wenn das Smoke-Gate fehlschlägt", () => {
    expect(smokeFailureBlock).toContain("exit 1");
  });

  it("hängt den Compose-Tag bei fehlgeschlagenem Smoke auf das vorherige Image zurück", () => {
    expect(smokeFailureBlock).toContain('podman tag "$PREV_IMAGE_ID" "$PREV_IMAGE_NAME"');
  });

  it("räumt den Wegwerf-Container über den EXIT-trap immer auf", () => {
    expect(deployScript).toMatch(/cleanup\(\) \{[\s\S]*?cleanup_smoke_container/);
    expect(deployScript).toMatch(
      /cleanup_smoke_container\(\) \{[\s\S]*?podman rm -f "\$SMOKE_CONTAINER_NAME"/
    );
    expect(deployScript).toContain("trap cleanup EXIT");
    // Bash führt den EXIT-trap bei Ctrl-C sonst nicht aus.
    expect(deployScript).toContain("trap 'exit 130' INT");
  });
});
