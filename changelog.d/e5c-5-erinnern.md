### Neu (Dienstplaner)

- **„Erinnern“ in Planen.** Neben „Teilen“ steht der Knopf **Erinnern** (nur für Planer). Er schickt jedem, der für Termine im gezeigten
  Zeitraum noch nicht geantwortet hat, **eine eigene Mail mit seinen offenen Terminen** und einem Knopf „Im Dienstplaner eintragen“ direkt in
  „Wann kann ich?“. Das Fenster zeigt die Dienstgruppen als Knöpfe mit der Zahl der Fehlenden, darunter die Empfänger – mit Haken zum Abwählen
  und **Vorschau** der Mail –, „Text anpassen“ (Betreff und Text) und „Eine Kopie an mich“. Erinnert wird, wer weder Ja/Vielleicht noch Nein
  (Abwesenheit) eingetragen hat und dort nicht schon eingeteilt ist. **Es wird wirklich verschickt** – über ChurchTools, Absender bist du.
- **Sicher beim Verschicken.** Antworten oder Abwesenheiten einer Gruppe nicht sichtbar, Ladefehler: Die Gruppe ist **gesperrt** (mit Grund) –
  nie bekommt jemand eine Erinnerung, nur weil man seine Antwort nicht sehen kann. Hakt ChurchTools mitten im Versand, **hält das Fenster an**
  („3 von 8 verschickt“), schickt nichts doppelt und sagt, bei wem unklar ist, ob die Mail rausging; „An die übrigen senden“ schickt nur, was
  noch fehlt.

### Intern (Dienstplaner)

- Die volle Adresse einer Seite der Erweiterung (Instanz + `/ccm/<Kürzel>/` + Adresse) baut **eine** Funktion (`erweiterungsLink` in
  `ui/erweiterung/kuerzel.ts`) – für die Mail „Erinnern“, den Beitrag der Protokolle und den Link zur Musik-App.
