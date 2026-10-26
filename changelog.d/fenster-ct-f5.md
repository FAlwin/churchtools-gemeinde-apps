### Geändert (Organigramm und Protokolle, E6-O F5, #741)

- **Die letzten Fenster im ChurchTools-Aufbau:** im Organigramm das Fenster einer Gruppe und einer Person, in den
  Protokollen „Gruppe einrichten“ und „Vorlage“ – Titel links, **X rechts**, Knöpfe **rechts unten** (am Handy
  untereinander, Hauptknopf oben). Damit haben alle Fenster aller Apps diesen Aufbau.
- **Fenster einer Gruppe (Organigramm):** Austragen, Rolle ändern, Person aufnehmen, Obergruppe ändern/lösen/dazu und
  Untergruppe anlegen **ersetzen jetzt den Inhalt**, statt unter der Mitgliederliste zu erscheinen (Alwin). Unten
  stehen nur „Zurück“ und der Hauptknopf („Austragen“, „Ändern“, „Aufnehmen“, „Umhängen“ …); „Zurück“ führt zur
  Gruppe, ganz zu geht es über das X. Während etwas gespeichert wird, sind X und „Zurück“ gesperrt.
- **Vorlage (Protokolle):** „Speichern“ steht unten; „Vorlage löschen“ bleibt getrennt im Inhalt.
- Textknöpfe im Organigramm („Erneut versuchen“, „Wie heute“) sehen aus wie im Dienstplaner: halbfett statt
  unterstrichen, gesperrt blasser.

### Intern (E6-O F5)

- `ui/fenster/fensterAufbau.test.ts` prüft jetzt **alle** Apps – die Ausnahmeliste (`NOCH_NICHT_UMGEZOGEN`) ist weg,
  dazu ein Test, dass wirklich alle Apps im Blick sind.
- Die Schritt-Bausteine im Organigramm (`StrukturSchritte`, `MitgliedSchritte`) zeigen nur noch den Inhalt; Auswahl
  (Person, Rolle) und Knöpfe hält `GruppenFenster`, „Anlegen“ schickt das Formular per `form=` ab.
- Drei gleiche `.link`-Stile (Organigramm) nutzen `m.textKnopf`; entfernt: `.primaer` in „Gruppe einrichten“ und
  „Vorlage“.
