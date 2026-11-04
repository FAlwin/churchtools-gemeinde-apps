### Neu (Dienstplaner)

- **Reiter „Abwesenheiten“** (Bauplan E7-2c, Entwurf `e7-2-abwesenheiten.html`): dieselbe Seite wie in der Musik-App –
  Termine abhaken, Zeitraum eintragen, ändern, löschen, direkt in ChurchTools, für jeden (die eigenen Abwesenheiten
  braucht kein Recht). Der Platzhalter „Hier trägst du bald ein …“ ist weg; die Karte auf der Startseite führt hierher.
- **Eigene Dienste unter jedem Termin:** „Du bist eingeteilt: Ton“ bzw. „Angefragt: Gesang“. Wer einen solchen Termin
  abhakt, sieht in Rot „bitte auch den Dienst absagen“ – die Abwesenheit allein sagt dem Planer nichts.
- Der Filter nach Veranstaltung bildet sich wie in „Dienste“ aus den Terminen (jeder Name, der mehrfach vorkommt).

### Behoben (Musik-App + Dienstplaner)

- **Abwesenheiten auf schmalen Bildschirmen:** Zeitraum und Filter brechen um, statt dass der Filter-Knopf über den
  Rand ragt (gefunden bei der Abnahme E7-2c).

### Intern (Dienstplaner + Musik-App)

- Die gemeinsame Seite (`ui/abwesenheiten/AbwesenheitenSeite.tsx`) nimmt einen Zusatz je Termin (`terminZusatz`) und
  die Termin-Arten auch als Funktion der Termine. Die eigenen Dienste kommen in einem Aufruf aus
  `/persons/{ich}/servicerequests?only_future=true` (`shared/dienstplan/meineDienste.ts`).
