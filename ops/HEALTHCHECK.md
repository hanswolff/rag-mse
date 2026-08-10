# Laufende Health-Überwachung (optional)

Der Healthcheck in `compose.yaml` beschreibt, **wie** geprüft wird
(`wget --spider http://127.0.0.1:3000/api/health`). Unter rootless Podman läuft er
zwischen zwei Deploys aber nicht von selbst — es gibt keinen Daemon, der ihn
periodisch anstößt. Echte Liveness prüft deshalb im Normalbetrieb nur HAProxy
über `option httpchk`; HAProxy nimmt einen toten Backend-Server aus dem Verkehr,
startet ihn aber nicht neu.

Wer den Container zusätzlich automatisch neu starten lassen will, installiert die
folgenden Units. Sie sind **bewusst nicht Teil von `deploy.sh`** — ein Auto-Restart
kann eine Absturzursache verschleiern und gehört als bewusste Entscheidung
installiert, nicht nebenbei ausgerollt.

## Installation

Als **User-Units** des Benutzers, dem die Container gehören — nicht als System-Units.
Rootless Podman braucht `XDG_RUNTIME_DIR` und die Session dieses Benutzers; eine
System-Unit mit `User=` findet den rootless Storage nicht und schlägt bei jedem Lauf
fehl. Das wäre schlimmer als keine Überwachung: Der fehlgeschlagene Healthcheck
würde alle zwei Minuten einen gesunden Container neu starten.

```bash
mkdir -p ~/.config/systemd/user
cp ops/systemd/beta-rag-healthcheck.service ~/.config/systemd/user/
cp ops/systemd/beta-rag-healthcheck.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now beta-rag-healthcheck.timer
```

Damit die Units auch ohne angemeldete Sitzung laufen, muss Lingering aktiv sein —
dieselbe Voraussetzung, die `deploy.sh` bereits für `podman-restart.service` prüft:

```bash
loginctl enable-linger "$(id -un)"
```

Läuft die Anwendung unter einem anderen Benutzer, werden die Units in dessen
Benutzerkontext installiert; `User=`/`Group=` gibt es in User-Units nicht.

## Prüfen

```bash
systemctl --user list-timers beta-rag-healthcheck.timer
journalctl --user -u beta-rag-healthcheck.service -n 50
podman healthcheck run rag-mse-app   # manuell
```

## Verhalten

- Alle 2 Minuten (erstmals 5 Minuten nach dem Boot) wird `podman healthcheck run`
  ausgeführt.
- Schlägt er fehl, startet `ExecStopPost` den Container neu. Ausgewertet wird
  `$SERVICE_RESULT` — die einzige Variable, die systemd dort immer setzt.
- Kein `Persistent=true`: Ein nachgeholter Healthcheck nach einem Standby sagt
  nichts über den aktuellen Zustand aus und würde nur einen Restart auslösen.
