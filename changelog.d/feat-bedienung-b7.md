### Geändert (Anmeldungen)

- **Startseite: jede Zeile ist selbst der Knopf.** Veranstaltungen, die Hinweise unter „Braucht deine Aufmerksamkeit“ und die
  Karte „Nachweise“ enden mit „›“; was zu tun ist, steht als Etikett („wartet auf Freigabe“, „3 Zahlungen offen“). Die Knöpfe
  „Anzeigen“, „Ansehen“, „Öffnen“ und „In ChurchTools“ neben den Zeilen entfallen. Führt eine Zeile nach ChurchTools, steht klein
  „in ChurchTools“ dabei. **Anstehend · Entwürfe · Vorbei** zeigt die Zahlen grau hinter den Wörtern (am Handy als „Anstehend ⌄“).
- **Veranstaltung: ein wandernder blauer Knopf.** Im Band „Nächster Schritt“ ist immer genau der nächste fällige Schritt blau
  (Termin wählen → Anmeldung einstellen → Bezahlung eintragen → Freigeben). Nach der Freigabe gibt es oben keinen blauen Knopf mehr.
  „Bearbeiten“ an den Karten ist blauer Text ohne Rahmen.
- **Gewohnheit: „Freigeben“ und „Verwalten“ liegen im ⋯-Menü.** „Verwalten“ steht jetzt oben rechts im **⋯**-Menü der
  Veranstaltung; „Freigeben“ steht erst im Band, wenn alles andere erledigt ist – vorher ebenfalls im **⋯**-Menü. „In ChurchTools“
  bleibt oben sichtbar; in der Liste der Startseite fehlt es – es ist einen Klick weiter, in der geöffneten Veranstaltung.
- **Gewohnheit: Anmeldungen.** **Spalten**, **Druckliste** und **Rundmail** liegen im **⋯**-Menü der Liste; **Von Hand** ist grün
  („Hinzufügen“). Die Gruppen der Startseite wählt man im **Filter** statt mit Knöpfen über der Liste.

### Intern

- Neuer Baustein `KlickZeile` (ganze Zeile als Knopf oder Link mit „›“), `AnsichtWahl` kennt eine Anzahl hinter dem Wort, `KopfLink`
  gibt es still. In `anmeldungen`: `Etikett` ist die eine Stelle für Status-Etiketten (B8b stellt dort um), `schritte.ts` kennt
  `blauerSchritt` und `freigebenPlatz`. Wächter `bedienKnoepfe`: Anmeldungen 104 → 102 rohe Knöpfe.
