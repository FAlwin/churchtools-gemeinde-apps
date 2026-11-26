### Behoben (Protokolle)

- **Termin-Vorlagen mit Events:** Eine in ChurchTools gespeicherte Vorlage mit Eventvorlage setzt diese jetzt beim Anwenden in alle Zeilen des Reiters „Events“. Vorher blieb die Auswahl leer, weil ChurchTools das Feld anders nennt als vermutet (gemessen: `events: [{eventTemplate: "0"}]`). „Als Vorlage speichern“ schreibt die Eventvorlage jetzt im selben Format mit.
- **Vorlage mit „Im Auftrag von“:** Hat eine ChurchTools-Vorlage „Im Auftrag von“ gesetzt, ist diese Person der Einlader der Besprechungsanfrage, und auch du bekommst eine Mail. Der Fuß des Fensters sagt das jetzt („Die Einladung geht sofort per Mail an 1 Person.“), statt „Es werden keine Einladungen verschickt“.
