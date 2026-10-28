### Geändert (Ablauf in Musik-App und Dienstplaner, E6-O O3, #747)

- **Das Punkt-Fenster sieht aus wie ChurchTools** (Variante B des Fenster-Entwurfs, abgenommen 23.10.2026): Titel des
  Punkts links, X rechts; darunter „Position 2 von 8 · 10:00 – 10:04“ mit **‹ ›** zum vorigen und nächsten Eintrag.
  Die Felder stehen als **Liste „Beschriftung | Feld“** in einer umrandeten Fläche, alle gleichzeitig bearbeitbar;
  unten links **„Eintrag löschen“** (rot), rechts „Abbrechen · Speichern“. Am Handy stehen die Knöpfe untereinander.
- **‹ › blättern nur, wenn nichts ungespeichert ist** – sonst sind sie gesperrt, mit dem Hinweis „Zum Blättern erst
  speichern oder abbrechen.“ (Alwin). Beim Blättern blendet das Fenster nicht neu ein.
- **„Zuständig“ ist eine Zeile mit Pfeil** (Alwin): Sie zeigt die Dienste ohne Klammern und die eingeteilten Personen;
  ein Tipp öffnet die Bearbeitung im Fenster („Zurück · Übernehmen“). Gespeichert wird weiter erst mit „Speichern“.
- **„Lied“ ist eine Zeile mit Pfeil** (Musik-App): öffnet „Lied verknüpfen“ – jetzt ebenfalls ein Fenster im
  ChurchTools-Aufbau („Abbrechen“ führt zurück, das X schließt ganz). Leer steht „+ Hinzufügen“ da.
- Ein Tipp neben das Fenster schließt weiterhin nur, wenn nichts geändert ist.

### Geändert (Dienstplaner)

- **Am Rechner und iPad steht das grüne „+“ oben rechts im Ablauf** (wie „+ Termin“ im ChurchTools-Kalender, mit Menü
  „Programmpunkt · Überschrift hinzufügen“) statt des blauen Punkts unten rechts; am Handy bleibt der Punkt (Alwin,
  28.10.2026 – wie die Musik-App seit S2).
- **Der Reiter „Termine“ heißt jetzt „Dienste“** (Alwin) – oben in der Leiste, am Handy unten, als Überschrift der
  Liste und im Zurück-Knopf eines Termins. Die Adresse bleibt `#/termine`, gemerkte Links gehen weiter.

### Intern (E6-O O3)

- `Sheet` kann mehr: `links` (ein Knopf ganz links in der Fußzeile, auch im Dokument zuerst), `mittel` (560 px),
  `onHintergrund` (eigener Weg für den Tipp daneben) und `einblenden={false}` (ohne Einblenden, wenn ein Fenster ein
  gleiches ersetzt). Neue Knopf-Art `FensterKnopf art="loeschen"`.
- Das Punkt-Fenster war ein eigenes Overlay und fiel deshalb nie unter `fensterAufbau.test.ts`; jetzt ist es ein
  `Sheet`, ebenso die Liedwahl der Musik-App. `zeitPlus` und `zustaendigText` liegen in `shared/ct/ablaufZeile.ts`.
- `LiedKarte` kennt `flach` (ohne Rahmen, für die Feldliste).
