### Neu (Dienstplaner)

- **Meine Dienste teilen** (Bauplan E8-3, Entwurf `e8-teilen.html`): Unter Dienste → Meine steht neben „Meine | Alle“
  „Teilen“. Das Blatt nennt alle kommenden eigenen Dienste – Datum mit Uhrzeit, Termin, Dienst, zugesagt oder angefragt –,
  z. B. für den Familienkalender; im Kopf der eigene Name. Gelesen wird frisch beim Öffnen, nicht nur die geladenen
  Wochen der Liste. Vorschau, „Herunterladen“, „Teilen“.

### Geändert (Dienstplaner + Musik-App + Protokolle)

- **„Filter“ am Handy nur als Symbol** – wie die anderen Kopfknöpfe; die Zahl der ausgeblendeten bleibt sichtbar. Sonst
  rutschte „Teilen“ unter Dienste → Meine in eine eigene Zeile. Gilt überall, wo es den Filter gibt: Dienste und Planen
  im Dienstplaner, Abwesenheiten der Musik-App, To-dos der Protokolle.

### Intern

- Kern `shared/dienstplan/meineBlatt.ts` aus den Einteilungen von `einteilungenAus` (derselbe Erzeuger wie beim
  Tauschen), gezeichnet mit dem Plan-Blatt (`planBlattPdf`). `ladeIch` liest jetzt auch den Nachnamen (`nachname`).
