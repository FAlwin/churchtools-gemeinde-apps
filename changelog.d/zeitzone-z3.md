### Geändert (Musik-App)

- **Auch die Musik-App rechnet mit der Uhr der Gemeinde** (#847, Schritt Z3). Die Zeitzone kommt in der
  Server-Variante aus `ZEITZONE` (über `/api/site-config`), in der Erweiterung aus ChurchTools. Bisher nahmen „heute“,
  der Offline-Stand und die Abwesenheiten die Uhr des Geräts, und Tag, Monat, Wochentag und Uhrzeit der Terminkarten
  standen fest auf Berlin, auch wenn `ZEITZONE` etwas anderes sagte. In Deutschland ändert sich nichts Sichtbares.

### Intern (alle Apps)

- `client/src/utils/heute.ts` ist weg (`heuteImKalender`). `wochentagName` in `shared/ct/datum.ts`. Die drei
  `plusTage`-Nachbauten (Anmeldungen, Abwesenheiten, Dienstplaner) nutzen `plusTage`. Der Zeitzonen-Wächter kennt jetzt
  auch nachgerechnete Tage und hat nur noch zwei feste Ausnahmen.
- Zwei Client-Tests fordern die Node-Typen jetzt selbst an; sie kamen bisher still über `heute.test.ts`.
