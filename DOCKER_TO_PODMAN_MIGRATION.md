# Migration einer produktiv betriebenen Seite von Docker zu rootless Podman

Diese Anleitung beschreibt, wie ein laufender, produktiv deployter Stack (App
hinter HAProxy) von **Docker / Docker Compose** auf **rootless Podman mit
podman-compose** umgestellt wird – mit minimaler Downtime und einem klaren
Rollback-Pfad. Sie dokumentiert die für dieses Repository tatsächlich
durchgeführte Migration und lässt sich als Vorlage für vergleichbare Setups
verwenden.

> **Hinweis:** Frühere Versionen dieses Stacks enthielten zusätzlich einen
> Redis-Dienst für das Rate-Limiting. Dieser wurde entfernt – das Rate-Limiting
> läuft jetzt In-Process im Arbeitsspeicher der App. Falls Ihr Bestandsstack
> noch Redis enthält, lassen Sie den Dienst beim Cutover einfach weg.

> **Geltungsbereich:** Nur Container-Laufzeit und Orchestrierung wechseln.
> HAProxy (Host-Dienst) und die Host-Build-Pipeline (`deploy.sh` baut die
> Next.js-Artefakte auf dem Host, das Image *führt* sie nur aus) bleiben
> unverändert.

---

## 1. Warum die Umstellung kein 1:1-Tausch ist

Rootless Podman ist weitgehend Docker-CLI-kompatibel, aber zwei Eigenschaften
verändern das Verhalten und müssen aktiv behandelt werden:

1. **Bind-Mount-Berechtigungen (User-Namespace).** Rootless-Container bilden
   UIDs über einen User-Namespace ab. Ein host-eigenes Verzeichnis wie `./data`
   ist im Container ohne weitere Konfiguration **nicht** schreibbar. Lösung:
   `userns_mode: keep-id`, damit der den Container startende Host-Benutzer auf
   die App-UID im Container abgebildet wird.

2. **Sichtbare Quell-IP / Trusted Proxy.** Podman nutzt nicht das
   Docker-Bridge-Netz (`172.16.0.0/12`). Die im Container sichtbare Quell-IP
   einer durch HAProxy weitergeleiteten Anfrage unterscheidet sich daher. Ist
   die unmittelbare Quell-IP nicht in `TRUSTED_PROXY_IPS` enthalten, kann die
   App `X-Forwarded-For` nicht auswerten – das bricht Login-Rate-Limiting und
   Client-IP-Logging. `TRUSTED_PROXY_IPS` muss an das Podman-Netz angepasst
   werden.

Alles Weitere ist im Wesentlichen Umbenennen von Dateien und Ersetzen von
`docker …` durch `podman …` bzw. `podman-compose …`.

---

## 2. Voraussetzungen prüfen

Auf dem Zielserver:

```bash
podman --version            # >= 4.x empfohlen (getestet mit 5.7.0)
podman-compose --version    # >= 1.x         (getestet mit 1.5.0)
id -u                       # der Deploy-Benutzer, der Podman rootless startet

# subuid/subgid-Bereiche müssen für den Deploy-Benutzer existieren:
grep "$USER" /etc/subuid /etc/subgid
```

Fehlen `podman` / `podman-compose`, vorher installieren (Distributionspaket).
Fehlen subuid/subgid-Einträge, mit `usermod --add-subuids 100000-165535
--add-subgids 100000-165535 "$USER"` ergänzen.

---

## 3. Datei-Umbenennungen (Historie erhalten)

Podman/buildah bevorzugen OCI-neutrale Namen. Mit `git mv` umbenennen, um die
Git-Historie zu bewahren:

| Vorher                 | Nachher            |
| ---------------------- | ------------------ |
| `Dockerfile`           | `Containerfile`    |
| `.dockerignore`        | `.containerignore` |
| `docker-compose.yml`   | `compose.yaml`     |
| `docker-entrypoint.sh` | `entrypoint.sh`    |

```bash
git mv Dockerfile Containerfile
git mv .dockerignore .containerignore
git mv docker-compose.yml compose.yaml
git mv docker-entrypoint.sh entrypoint.sh
```

Anschließend die internen Referenzen anpassen:

- **`Containerfile`**: `COPY … entrypoint.sh` und `CMD ["/app/entrypoint.sh"]`.
  Der nicht-root `USER` passt bereits zu rootless – inhaltlich keine weitere
  Änderung nötig.
- **`compose.yaml`**: `build.dockerfile: Containerfile`.

---

## 4. `compose.yaml` anpassen

Die beiden rootless-spezifischen Punkte aus Abschnitt 1 umsetzen:

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Containerfile
      args:
        APP_UID: ${APP_UID:-1000}
        APP_GID: ${APP_GID:-1000}
    user: "${APP_UID:-1000}:${APP_GID:-1000}"
    # Rootless: den Host-Benutzer, der podman startet, auf die App-UID im
    # Container abbilden, damit der host-eigene ./data-Mount schreibbar bleibt –
    # unabhängig von der tatsächlichen UID des Host-Benutzers.
    userns_mode: "keep-id:uid=${APP_UID:-1000},gid=${APP_GID:-1000}"
    ports:
      - "127.0.0.1:3000:3000"        # nur an Loopback binden; nur HAProxy erreicht es
    environment:
      - TRUSTED_PROXY_IPS=${TRUSTED_PROXY_IPS:-127.0.0.1/32,::1,10.0.2.0/24,10.88.0.0/16}
      # … restliche Variablen unverändert …
    volumes:
      - ./data:/app/data:rw
```

**Wichtige Details:**

- **`keep-id:uid=…,gid=…`** statt nur `keep-id`. Reines `keep-id` mit
  `user: "1000:1000"` funktioniert nur, wenn die UID des Host-Deploy-Benutzers
  zufällig 1000 ist. Die explizite Form pinnt die Abbildung für jede Host-UID.
- **Port nur an `127.0.0.1` binden.** Dadurch ist der breitere
  `TRUSTED_PROXY_IPS`-Default unkritisch, weil ausschließlich HAProxy den
  Container erreicht.

---

## 5. `deploy.sh` übersetzen

Alle Docker-Aufrufe durch Podman-Äquivalente ersetzen – die vorhandene
Sicherheitslogik bleibt erhalten:

| Docker                | Podman                          |
| --------------------- | ------------------------------- |
| `docker compose <cmd>`| `podman-compose <cmd>`          |
| `docker run …`        | `podman run --userns=keep-id …` |
| `docker inspect …`    | `podman inspect …`              |
| `docker image prune`  | `podman image prune`            |

Podman versteht dieselben Go-Templates (`{{.State.Health.Status}}`), daher
funktioniert das Health-Gating beim Recreate unverändert. Erhalten bleiben:
Daten-Schreibbarkeits-Preflight, Pre-Deploy-SQLite-Backup, Health-gegateter
Recreate, Container-ID-Wechsel-Prüfung und CSP-Smoke-Test.

> **Falle beim Suchen-und-Ersetzen:** `docker compose ` (mit Leerzeichen) durch
> `podman-compose` (ohne Leerzeichen) zu ersetzen erzeugt kaputte Tokens wie
> `podman-composeps`. Danach immer `bash -n deploy.sh` zur Syntaxprüfung
> ausführen.

Daten-Schreibbarkeits-Preflight (rootless):

```bash
podman run --rm --userns=keep-id -v "$PROJECT_DIR/data:/data:rw" \
  alpine:3.20 sh -lc 'touch /data/.write-test && rm -f /data/.write-test'
```

---

## 6. Boot-Persistenz (podman-restart.service + Lingering)

Rootless-Container laufen unter einer User-Session und überleben standardmäßig
keinen Logout/Reboot. `podman-restart.service` startet zusammen mit
`restart: unless-stopped` aus `compose.yaml` alle Container wieder, Lingering
sorgt dafür, dass das auch ohne aktive Login-Session passiert:

```bash
systemctl --user enable --now podman-restart.service
loginctl enable-linger "$USER"   # entscheidend: Stack überlebt Logout/Reboot
```

**Dafür ausdrücklich keine eigene Container-Unit anlegen.** Die früher hier
empfohlene `ops/systemd/rag-mse.service` (`Type=simple`,
`ExecStart=podman-compose up` im Vordergrund, `ExecStop=podman-compose down`)
ist mit `deploy.sh` unvereinbar: Sobald das Skript den App-Container stoppt oder
per `--force-recreate` neu erzeugt, endet der angehängte `up`-Prozess mit Status
0, systemd führt `ExecStop` aus und löscht Container samt Netzwerk mitten im
Deployment. Auf der Schwesterseite dedimax.de hat genau das am 2026-07-30 einen
Ausfall verursacht. Die Unit wurde deshalb entfernt; `deploy.sh` bricht ab,
falls sie wieder auftaucht.

`deploy.sh` steuert `podman-compose` während Deployments direkt und ist der
einzige Besitzer des Containers.

---

## 7. Tests & Konfiguration nachziehen

- `__tests__/docker-hardening.test.ts` → `container-hardening.test.ts`, Pfade auf
  `../Containerfile` / `../.containerignore` zeigen; Assertions
  (`FROM node:22 AS runner`, Host-Artefakt-COPYs, kein `pnpm install/build` im
  Image) bleiben.
- `__tests__/proxy-trust.test.ts`: Testnamen auf Podman-neutrale Wortwahl
  umstellen.
- `__tests__/haproxy-config.test.ts`: Kommentar-Assertion auf den neuen
  Podman-Wortlaut anpassen.
- `.env.example`, `README.md`, `PRODUCTION_CHECKLIST.md`, `QA_CHECKLIST.md`,
  `AGENTS.md`, `haproxy.cfg.example`: Docker-Referenzen auf Podman umstellen und
  veraltete Aussagen (z. B. „Build im Container“, BuildKit-Cache) korrigieren.

---

## 8. Vor dem Umschalten validieren

```bash
pnpm test            # container-hardening- und proxy-trust-Tests müssen grün sein
pnpm lint
podman-compose -f compose.yaml config   # parst die Datei, zeigt aufgelöste userns/user-Werte
bash -n deploy.sh    # Syntaxprüfung
```

---

## 9. Produktiv-Cutover (minimale Downtime)

Auf dem Zielserver, im Projektverzeichnis:

```bash
# 1. Sicherheitskopie der Daten und der alten Compose-Definition
cp -a data "data.backup-$(date +%Y%m%d_%H%M%S)"

# 2. Alten Docker-Stack stoppen (HAProxy zeigt weiter auf 127.0.0.1:3000)
docker compose down        # oder: docker stop <container>

# 3. Neuen Code mit Podman-Migration ausrollen
git pull
./deploy.sh                # baut Host-Artefakte + Image, recreated Container health-gegatet
```

Da HAProxy unverändert auf `127.0.0.1:3000` weiterleitet, betrifft die Downtime
nur das kurze Fenster zwischen `down` und dem health-bestätigten Start des
Podman-Containers durch `deploy.sh`.

---

## 10. Nach dem Cutover prüfen

```bash
podman-compose ps                       # app läuft
podman-compose exec -T app id           # erwartete UID:GID (Schreibrechte auf ./data)
curl -fsS http://127.0.0.1:3000/api/health   # 200
# echte Anfrage durch HAProxy senden, dann:
podman-compose logs --tail=50 app       # geloggte Client-IP prüfen
```

**`TRUSTED_PROXY_IPS` final justieren:** Erscheint in den Logs die echte
Client-IP, passt der Default. Erscheint stattdessen eine Podman-Gateway-IP,
diese exakte Gateway-Adresse in `TRUSTED_PROXY_IPS` eintragen und neu starten.
Der genaue Wert ist abhängig vom Network-Backend (slirp4netns vs. pasta) und der
Podman-Version und lässt sich erst am laufenden Stack endgültig bestimmen.

**Fallback bei IP-Problemen:** Den App-Container rootless mit Host-Networking
betreiben (`network_mode: host`, App auf `127.0.0.1`). Dann ist die
Quell-IP schlicht Loopback und `TRUSTED_PROXY_IPS=127.0.0.1/32` exakt.

---

## 11. Rollback

Solange die alten Docker-Dateien per `git mv` umbenannt (nicht gelöscht) wurden
und das Daten-Backup aus Schritt 9.1 existiert:

```bash
podman-compose down
git checkout <vorheriger-commit>   # stellt Dockerfile/docker-compose.yml wieder her
docker compose up -d
```

`./data` (SQLite-DB, Uploads, Logs) ist zwischen beiden Laufzeiten
kompatibel – es ist dasselbe host-eigene Verzeichnis. Bei Datenkorruption das
in Schritt 9.1 angelegte `data.backup-*` zurückspielen.

---

## Checkliste

- [ ] `podman` + `podman-compose` installiert, subuid/subgid für Deploy-Benutzer vorhanden
- [ ] Dateien per `git mv` umbenannt (Dockerfile → Containerfile usw.)
- [ ] `compose.yaml`: `userns_mode: keep-id:uid=…,gid=…`, Port an `127.0.0.1`, `TRUSTED_PROXY_IPS` gesetzt
- [ ] `deploy.sh`: alle docker-Aufrufe auf podman übersetzt, `bash -n` sauber
- [ ] `podman-restart.service` aktiviert, `loginctl enable-linger` gesetzt, **keine** eigene Container-Unit installiert
- [ ] Tests + Doku auf Podman umgestellt, `pnpm test` / `pnpm lint` grün
- [ ] Cutover: Datensicherung → alten Stack down → `./deploy.sh`
- [ ] Health 200, `exec app id` korrekt, Client-IP in Logs plausibel
- [ ] `TRUSTED_PROXY_IPS` am laufenden Stack final justiert
