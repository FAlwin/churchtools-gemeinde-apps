### Intern (Organigramm)

- **Gruppenwechsel der Kinder – Kern ohne Oberfläche** (Bauplan O9-1): `shared/organigramm/gruppenwechsel.ts` rechnet
  aus dem Ferienkalender die Wechseltage (erster Montag nach den Sommerferien, Ankündigung 8 Wochen vorher, Aufnahme 14
  Tage), sagt voraus, wer wechselt, und baut die Regeln für Wechsel-Gruppe, neue und alte Gruppe, die Aufräum-Routine
  und die drei Leiter-Rechte am Typ „Gruppenwechsel“. Einstellbar für andere Gemeinden (Stufen, Stichtag, Fristen,
  Ferienkalender); `einstellungFehler` fängt Werte ab, mit denen die Regeln stillschweigend falsch wären. Die Tests
  werten die erzeugten Regeln mit einem kleinen Nachbau der ChurchTools-Auswertung aus und vergleichen mit der Vorschau.
- `alterAm` liegt jetzt in `shared/ct/datum.ts` (vorher `shared/anmeldung/formular.ts`), daneben neu `vorJahren` – „Stichtag
  minus N Jahre“ stand im Anmeldeformular (Musterdaten) schon einmal von Hand und nutzt es jetzt mit. Der Typ
  `RoutinenSchritt` liegt in `shared/ct/routinen.ts` (vorher `shared/anmeldung/ablaeufe.ts`, neu mit Warten nach Dauer).
  Die alten Stellen reichen weiter, die Anmeldungen ändern sich nicht.
