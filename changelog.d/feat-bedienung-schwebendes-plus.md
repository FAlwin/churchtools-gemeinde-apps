### Geändert (Protokolle + Anmeldungen + Organigramm)

- **„Neu anlegen“ ist am Handy überall der schwebende grüne Kreis mit „+“** (unten rechts über der Reiterleiste) statt eines grünen Quadrats in der Kopf- oder Werkzeugzeile – wie schon in Dienstplaner, Website und Musik-App. Am Rechner und iPad bleibt es der grüne Knopf. Betroffen: **Protokolle** (Neues To-Do, Neu ⌄ in den Sitzungen – das Plus öffnet dasselbe Menü als Blatt von unten –, Neues Protokoll auf der Startseite), **Anmeldungen** (Neue Veranstaltung, Neue Nachweis-Art, Neue Regel, Von Hand) und **Organigramm** (Neuer Bereich im Plan). Rechte und Bedingungen sind unverändert: Wer den Knopf sah, sieht das Plus.
- Der Hinweistext am Knopf „Neues To-Do“ und „Neues Protokoll“ am Rechner („auch ohne Protokoll“, „ohne Termin“) entfällt; das Plus am Handy trägt nur den Namen.

### Intern

- Neuer Wächter `ui/design/neuNurSchwebend.test.ts`: `KopfKnopf neu` darf nur noch in `ui/bedienung` stehen (`useNeuAnlegen`, `HinzufuegenMenue`); jede Seite nimmt einen der beiden Bausteine und bekommt den Handy-Zweig mit.
