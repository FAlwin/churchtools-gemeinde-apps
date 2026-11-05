### Geändert (Anmeldungen + Dienstplaner + Protokolle + Organigramm)

- **Alle Erweiterungen rechnen mit der Uhr der Gemeinde** (#847, Schritt Z2). Bisher bestimmte gut ein Dutzend
  Stellen die Zeitzone selbst – meist die des Geräts, im Dienstplaner teils fest Berlin. Jetzt gilt überall die aus
  ChurchTools: für „heute“, Sitzungen, Termine, Abwesenheits-Uhrzeiten, „Angehängt am“ bei Termin-Dateien, „Zuletzt“
  im Organigramm sowie den Stand und Dateinamen gedruckter Listen und PDFs. In Deutschland ändert sich nichts
  Sichtbares bis auf eine Kleinigkeit: Der Stand auf Drucklisten und geteilten Terminblättern heißt jetzt „Stand
  05.11.2026 13:07“ ohne Komma, wie bei den Termin-Dateien.

### Intern (alle Apps)

- `uhrText` und `datumUhrText` in `shared/ct/zeit.ts`, `heuteImKalender` nimmt optional eine Zone. Der Wächter
  `ui/design/eineZeitzone.test.ts` verbietet eigene Zeitzonen, eigenes „heute“ und Anzeigen in Gerätezeit.
