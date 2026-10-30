### Geändert (Musik-App)

- **Einführung im Liedblatt nachgezogen (Scheibe B5).** Schritt 1 nennt jetzt auch „Weiter“ und „Zurück“ unten,
  Schritt 2 das neue Fenster des Lieds (Tonart und Kapo, Akkorde oder nur Text, Version, „Bearbeiten“, zuletzt
  gesungen). Die Einführung bleibt bei Version `chart-v9` – nur neue Nutzer sehen sie automatisch (Alwin, 28.10.2026).

### Intern (Musik-App)

- `e2e/blatt-einfuehrung.spec.ts` klickt die Einführung im Liedblatt in allen Größen und im Scroll-Modus durch: Fehlt
  das Ziel eines Schritts, überspringt sie ihn sonst stillschweigend.
