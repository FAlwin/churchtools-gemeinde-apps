### Neu (Dienstplaner)

- **Filter nach Kalender.** Unter „Dienste“ und in „Planen“ steht im Filter oben ein Abschnitt „Kalender“ – angehakt
  heißt gezeigt, gemerkt auf dem Gerät. Umbenannte Termine (z. B. „Ostergottesdienst“) bleiben so in der Auswahl,
  solange sie im richtigen Kalender liegen. „Veranstaltungen“ bietet dann nur noch Termine aus den angehakten
  Kalendern an; ＋ beim Zeitraum zählt ausgeblendete Kalender nicht mit. Gibt es nur einen Kalender, fehlt der
  Abschnitt.

### Intern (Musik-App + Dienstplaner)

- Die Kalender-Regeln des Termin-Filters (sichtbar?, welche Kalender im Menü, gemerkte IDs prüfen) stehen jetzt einmal
  in `shared/ct/kalenderFilter.ts`; die Terminliste der Musik-App nutzt sie mit, statt eigener Kopien.
