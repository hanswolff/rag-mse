# 02 — Coverage-Schwellen im Deploy-Gate erzwingen

Status: done

Ergebnis (05.08.2026): Ist-Stand zunächst 86,3/78,6/79,6/86,3 (Lines/Functions/
Branches/Statements) — Schwellen 80/70/70/80 erfüllt, keine Absenkung nötig.

Nachtrag aus dem Review desselben Tages: Ohne `collectCoverageFrom` zählte der
v8-Provider nur die von Tests geladenen Dateien; nie importierte Module waren für
das Gate unsichtbar. Mit der jetzt gesetzten Liste (`app/`, `lib/`, `components/`)
misst der Lauf die ganze Codebasis, der Ist-Stand liegt bei 72,2/74,9/80,6/72,2 und
die Schwellen stehen auf 72/74/80/72. Die kleineren Zahlen sind keine Absenkung,
sondern eine ehrlichere Messbasis: Branches und Functions steigen sogar (70 → 80
bzw. 70 → 74), und ein neues ungetestetes Modul senkt die Quote jetzt sichtbar,
statt wirkungslos zu bleiben.

Coverage-Lauf: ~104 s (v8-Provider), vertretbar gegenüber dem bisherigen Test-Gate.

**What to build:** Das Test-Gate in `deploy.sh` läuft mit Coverage, damit die in
`jest.config.ts` deklarierten `coverageThreshold`-Werte tatsächlich durchgesetzt
werden. Heute ruft das Gate `pnpm test` ohne Coverage auf — Jest prüft die Schwellen
dann nicht, sie sind reine Dokumentation.

Vorgehen:

1. Einmalig `pnpm test:coverage` laufen lassen und den Ist-Stand feststellen.
2. Liegt der Ist-Stand unter 80/70/70/80, die Schwellen in `jest.config.ts` auf den
   Ist-Stand (abgerundet) setzen — das Gate verhindert ab dann Verschlechterung,
   ohne dass ein Deploy an Altlasten scheitert.
3. `deploy.sh` von `pnpm test` auf einen Coverage-Lauf umstellen.

**Blocked by:** None — can start immediately.

- [x] Das Test-Gate in `deploy.sh` läuft mit Coverage und schlägt fehl, wenn eine
      Schwelle gerissen wird.
- [x] Die Schwellen in `jest.config.ts` entsprechen höchstens dem Ist-Stand zum
      Zeitpunkt der Umstellung (kein Deploy scheitert an Bestandscode).
- [x] Die Mehrlaufzeit des Gates bleibt vertretbar (v8-Provider; Richtwert: das
      Test-Gate darf sich nicht vervielfachen).
- [x] AGENTS.md nennt das Coverage-Gate unter den Qualitäts-Gates von `deploy.sh`.
