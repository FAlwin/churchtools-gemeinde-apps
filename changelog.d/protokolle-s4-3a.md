### Neu (Protokolle, S4-3a)

- **Feste Punkte zeigen jetzt etwas** (Alwin 26.10.2026, Entwurf 7): **„Offene To-Dos“** listet die offenen To-Dos der
  Gruppe aus früheren Sitzungen mit Status-Kreis, Wer und Bis (überfällige zuerst); darunter eingeklappt **„Seit der
  Sitzung am … erledigt“**. Im Editor hakt man sie direkt am Kreis ab, in der Lese-Ansicht ist es nur Anzeige.
  **„Protokoll der letzten Sitzung“** zeigt das letzte freigegebene Protokoll der Gruppe; **„Öffnen“** zeigt es in
  einem Fenster, ohne den Editor zu verlassen.
- Feste Punkte lassen sich nachträglich einfügen – über zwei Knöpfe in der Werkzeugleiste und im **„/“-Menü** (Gruppe
  „Feste Punkte“): Tagesordnungspunkt mit Titel, darunter der Punkt und eine Zeile für Notizen.
- **Umschalter „Schreiben | Lesen“** im Editor: zeigt dasselbe Protokoll als ruhige Lese-Ansicht, ohne Werkzeugleiste.
  Lesen setzt keine Sperre; was noch nicht gespeichert war, wird beim Umschalten sofort gespeichert.
- **Werkzeugleiste bricht am Rechner um** statt rechts abgeschnitten zu sein – Zitat, Trennlinie und die festen Punkte
  waren mit der Maus nicht erreichbar (ohne sichtbaren Rollbalken). Am Handy bleibt sie wischbar.

### Intern (Protokolle, S4-3a)

- Regel `shared/protokolle/festePunkte.ts`: `letztesProtokoll`, `offeneVonFrueher` (nutzt `offene`/`erledigtSeit`) und
  `festePunkteFesthalten` für die Freigabe (S6) – **bis zur Freigabe live, danach festgehalten** in `props.fest` des
  Verweis-Blocks. „Wie letztes Mal“ und Vorlagen übernehmen nichts Festgehaltenes.
- Ein Baustein `FesterPunkt` für Editor und Lese-Ansicht, `FestePunkteRahmen` (Kontext + Fenster). Titel der festen
  Punkte an einer Stelle (`FESTE_PUNKTE`, auch fürs Vorlagen-Fenster).
- Ein Klick in einen festen Punkt im Editor setzt weder Cursor noch Markierung (beim Durchklicken gefunden: Tippen
  danach ersetzte den Punkt bzw. zog zwei Tagesordnungspunkte zusammen) – Test für beide Hälften.
- `Sheet` kann `breit` (bis 760 px) für Fenster zum Lesen; neues Symbol `todo-liste`.
