### Intern

- **Ein Laden für die Erweiterungen: `useLaden`** (#845, Scheibe 3). Statt je Stelle eines eigenen `useEffect` mit
  `let aktuell = true` gilt EINE Regel: späte Antworten zählen nicht, Fehler laufen über `fehlerMeldung`, `neu()` ist
  „Erneut versuchen“. Umgestellt sind zuerst `ui/teilen` (PDF-Vorschau, PDF-Bau der Blätter) und das Organigramm (Logo,
  PDF, Gruppenrechte); die übrigen Erweiterungen folgen je in einer eigenen Scheibe. Ein Wächter hält umgestellte
  Ordner frei von neuen Ladeblöcken von Hand, die Prüfregel `exhaustive-deps` prüft die `deps` von `useLaden`.
- Neue Tests für die PDF-Vorschau und den PDF-Bau der Teilen-Fenster – beides war bisher ungeprüft.
