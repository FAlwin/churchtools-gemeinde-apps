### Neu (Protokolle, S4-1)

- **Protokolle schreiben** (Bauplan S4-1, Entwurf 7). Öffnet die Leitung ein Protokoll im Entwurf, steht sie gleich im
  Editor (BlockNote 0.56, fest gepinnt): Text, Tagesordnungspunkt (Überschrift 1, nummeriert) und Überschrift 2/3,
  Aufzählung, Nummerierung, Checkliste, Zitat, Trennlinie, Einrücken beliebig tief (Tab/Umschalt+Tab), „/“-Menü,
  Kürzel wie „- “, Griffe zum Verschieben (nicht an normalem Text). Feste **Werkzeugleiste** oben – am Handy waagrecht
  wischbar – mit Rückgängig, Textart, fett/kursiv/unterstrichen/durchgestrichen, Markieren, Formatierung entfernen,
  Listen, Ein-/Ausrücken, Zitat, Trennlinie. Die Bereiche Beschlüsse · To-Dos · Termine darunter folgen dem Text live.
  Der Editor wird erst geladen, wenn jemand schreibt – wer nur liest, lädt ihn nie.
- **Automatisch speichern** (Alwin 24.10.2026): drei Sekunden nach der letzten Eingabe, oben „gespeichert 19:42“;
  scheitert es (Netz, ChurchTools), bleibt der Text im Editor, „nicht gespeichert – wird erneut versucht“, neuer Versuch
  nach zehn Sekunden. Gespeichert wird als Kopf + gepackte Teile in der Reihenfolge „neue Teile → nachlesen → Kopf →
  nachlesen → alte Teile löschen“; vor jedem Schritt wird frisch gelesen, nach jedem nachgelesen.
- **Schreibsperre** („Johann schreibt gerade“): entsteht mit der ersten Änderung – wer nur reinschaut, blockiert
  niemanden. Wer währenddessen öffnet, liest den gespeicherten Stand mit (alle 30 Sekunden) und kann das Schreiben mit
  Rückfrage **übernehmen**; das andere Fenster hört beim nächsten Speichern auf und behält seinen ungespeicherten Rest
  sichtbar. Dieselbe Person in zwei Fenstern oder auf zwei Geräten sperrt sich ebenso („Du schreibst gerade in einem
  anderen Fenster“). Hat inzwischen jemand anderes gespeichert, überschreibt das Fenster nichts, sondern bietet „Aktuellen
  Stand laden“ an. Verlassen mit Ungespeichertem fragt nach.
- **Einfügen aus Word:** Aufzählungen und Nummerierungen aus Word kommen als echte, verschachtelte Listen an (vorher
  Absätze mit „·“).
- **Markieren** erscheint auch in der Lese-Ansicht (neuer Wert `--markiert`).

### Intern (Protokolle, S4-1)

- `protokolle/src/schreiben.ts` (Sperre nehmen, speichern, übernehmen, freigeben), `schreibSteuerung.ts` (Zeitregeln,
  mit Fake-Timern getestet), Regeln `schreibLage`, `sitzungAusWerten`, `sperreVon`, `wertInhalt` in
  `shared/protokolle/speicher.ts`; die Sperre trägt jetzt eine Fenster-Kennung. `dokumentAusTeilen` zählt einen doppelt
  liegenden Teil desselben Stands nur einmal. `fremdeTypen`: Protokolle mit Blöcken, die der Editor nicht kennt, öffnen
  nur zum Lesen, damit nichts verloren geht.
- Die Bereiche (Beschlüsse · To-Dos · Termine) sind ein gemeinsamer Baustein `Bereiche.tsx` für Ansicht und Editor.
- `modulRechteAus` liegt jetzt in `shared/ct/modulRechte.ts` (vorher im Dienstplaner) – die Protokolle lesen damit, wer
  schreiben darf.
- Pack-Prüfung der Erweiterungen herausgelöst nach `scripts/globaleCss.mjs` und getestet: Selektoren mit Klasse/ID gelten
  wie in `cssBereich.ts` als unbedenklich, Kommas in `:is(…)` teilen nicht mehr (vorher ~260 Fehlalarme durch
  BlockNote/Mantine).
- Neue Linien-Symbole für die Werkzeugleiste (`liste`, `nummern`, `zitat`, `trennlinie`, `einruecken`, `ausruecken`,
  `format-weg`).
