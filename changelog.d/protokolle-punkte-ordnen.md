### Neu (Protokolle)

- **Punkte ordnen.** Tagesordnungspunkte und Unterpunkte stellt man jetzt in einem eigenen Fenster um: der Knopf **„Punkte
  ordnen“** steht rechts in der Werkzeugleiste (am Handy als Erstes) und ist ausgegraut, solange es nichts zu ordnen gibt.
  Das Fenster zeigt alle Punkte mit Nummer, Titel und einer Zeile, was mitwandert („3 Stichpunkte · 1 To-Do · 1 Beschluss“).
  **Ein Punkt nimmt seine Unterpunkte und seinen ganzen Inhalt mit, die Ebene bleibt:** Unterpunkte nur innerhalb ihres Punkts,
  Tagesordnungspunkte nur zwischen Tagesordnungspunkten; feste Punkte wie die Anwesenheit wandern normal mit, Text vor dem
  ersten Punkt bleibt oben. Umstellen geht mit **Ziehen am Griff** (Maus sofort, Finger nach kurzem Halten, eine blaue Linie
  zeigt nur erlaubte Stellen), mit **↑ ↓** an jeder Zeile und mit den Pfeiltasten auf dem Griff; **„Rückgängig“** im Fenster
  nimmt den letzten Schritt zurück. Erst **„Übernehmen“** ändert das Protokoll, als ein Schritt (ein Strg+Z im Editor holt
  alles zurück; To-Dos bleiben mit ihren Punkten verbunden). Am Handy füllt das Fenster den Bildschirm.

### Geändert (Protokolle)

- **Im Text lassen sich Tagesordnungspunkte und Unterpunkte nicht mehr ziehen.** Überschriften haben keinen Griff mehr (das
  Ziehen des ganzen Abschnitts und „Nach oben/Nach unten“ im Griff-Menü entfallen – dafür gibt es „Punkte ordnen“). Listen,
  Zitate, eigene Blöcke und Tabellen zieht man weiter einzeln am Griff; wer dabei mehrere Zeilen mit einer Überschrift
  markiert hat, zieht nur die Zeile am Griff.

### Intern (Protokolle)

- Neue Regel `shared/protokolle/gliederung.ts` (Gliederung aus dem Dokument, Umstellen mit Ebenen-Prüfung am Ergebnis) auf
  `abschnittEnde`/`abschnittVerschoben`; `ablegeStelle` und `nachbarStelle` sind entfallen, ebenso `abschnittZiehen.ts`
  samt Linie über `dropCursor`. `Sheet` hat `handyVoll` (bildschirmfüllend am Handy).
