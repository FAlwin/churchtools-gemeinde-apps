### Neu (Musik-App)

- **Abwesenheiten jetzt auch in der Musik-App in ChurchTools** (Dienstplaner E7-2b, Alwin 04.11.2026: nur noch die
  Erweiterung zählt). Der Reiter „Abwesenheiten“ ist **für alle da, die die Musik-App öffnen** (Rechtekonzept E2,
  Alwin 04.11.2026 – auf dem NAS weiter nur fürs Musikteam), und schreibt direkt in ChurchTools: Termine abhaken, Zeitraum eintragen, ändern, löschen. Ändern bleibt
  derselbe Eintrag, denselben Zeitraum gibt es nie doppelt.

### Geändert (Musik-App)

- **Alle Abwesenheiten sehen gleich aus** – kein graues „in ChurchTools eingetragen“ mehr. Neue Einträge aus ChurchTools
  heraus tragen kein „[Musikteam]“ mehr (auf dem NAS schreibt der Server es weiter).
- **Löschen fragt immer nach** – „Abwesenheit löschen?“ mit Grund und Zeitraum, im Fenster selbst. Vorher fragte nur
  ein Eintrag, der direkt in ChurchTools gemacht wurde.

### Intern (Musik-App + Dienstplaner)

- Die Abwesenheiten-Seite ist ein **gemeinsamer Baustein** (`ui/abwesenheiten/`): Seite, Fenster, Helfer; Daten,
  Schreiben und Rahmen kommen je App von außen. `pages/Availability.tsx` ist nur noch der Rahmen der Musik-App. Die
  Tages- und Monats-Helfer liegen in `shared/ct/` (`wochen.ts`, `monate.ts`). Die Schreib-Hooks (`useCreateAbsence` …
  `useSaveAbsenceChanges`) sind weg – gesammelt gespeichert wird in der Seite, weiter erst anlegen, dann löschen,
  nacheinander. Der Dienstplaner bekommt die Seite mit E7-2c.
