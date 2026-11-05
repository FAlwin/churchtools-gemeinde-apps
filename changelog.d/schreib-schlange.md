### Behoben (Musik-App)

- **Anmerkungen gehen nach einem automatischen Abmelden nicht mehr aus der Warteschlange verloren** (#846). Bisher
  warfen die Anmerkungen ausstehende Uploads weg, solange der Abgleich abgeschaltet war (die Einstellungen behielten
  sie). Nach der nächsten Anmeldung gehen sie jetzt mit hoch.
- **Eine Änderung während eines laufenden Uploads übersteht jetzt auch einen Neustart.** War der Upload danach
  erfolgreich, wurde der Merker für den Neustart abgehakt, obwohl schon die nächste Änderung wartete. Wurde die App
  genau dann beendet, fehlte sie.

### Intern (Musik-App)

- Die Speicher-Warteschlange von Anmerkungen und Einstellungen ist jetzt EIN Baustein (`services/schreibSchlange.ts`,
  #846): Verzögern, Merker, Wiederholen und alle Fehlerzweige an einer Stelle, auch für Abgleich und Migration. Neu:
  Ein 413 bei der einmaligen Migration der Einstellungen wird gemeldet. Ein Test, der echt 650 ms wartete, läuft mit
  Fake-Timern.
