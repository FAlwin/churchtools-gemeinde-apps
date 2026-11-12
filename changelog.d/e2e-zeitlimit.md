### Intern (CI)

- Jeder CI-, Staging- und Release-Job hat ein Zeitlimit (10–30 Minuten, je nach üblicher Dauer; e2e 20). Am 11.11.2026
  hing die Installation der Testbrowser sechs Stunden lang, weil der Ubuntu-Paketserver nicht erreichbar war; jetzt
  scheitert ein hängender Job schnell und kann neu gestartet werden. Die Erweiterungs-Releases erben die Grenze aus
  `erweiterung-release.yml`.
