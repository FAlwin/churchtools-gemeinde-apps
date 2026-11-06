### Intern

- **E2E: keine fremden Dev-Server mehr still mittesten.** Lokal übernimmt Playwright Server, die schon auf seinen Ports
  laufen – bisher auch die einer anderen Arbeitskopie, deren Code dann still mitgetestet wurde (am 06.11.2026 zweimal
  passiert). Jetzt prüft die Konfiguration vorher je Port, aus welchem Ordner der Server läuft: aus dieser Arbeitskopie
  → weiter mitbenutzen, aus einer anderen → Abbruch mit Port und Ordner (`scripts/fremde-server.mjs`). Die Ports kommen
  aus den `webServer`-Einträgen selbst. In der CI ändert sich nichts.
