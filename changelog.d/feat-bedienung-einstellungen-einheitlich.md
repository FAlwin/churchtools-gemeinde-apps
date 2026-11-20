### Geändert (Musik-App + Protokolle)

- **Überall derselbe Name: „Einstellungen“** („Ruhige Bedienung“, neue Regel R13). In jeder Erweiterung gibt es höchstens
  einen Reiter „Einstellungen“, er steht immer ganz hinten und enthält nur Einstellungen – wie es die ChurchTools Dev
  Platform je Erweiterung vorsieht.
- **Musik-App:** Der Reiter „Mehr“ heißt jetzt **„Einstellungen“** (mit dem Zahnrad wie in den anderen Erweiterungen). Die
  **Ablaufvorlagen** findest du jetzt bei den **Terminen im „⋯“-Menü** rechts oben (früher: Mehr → Abläufe); „‹ Termine“
  führt zurück. Darstellung, Links, Team-Notizen, Verwaltung, Hilfe und Abmelden bleiben unter „Einstellungen“.
- **Protokolle:** Der Reiter „Verwaltung“ heißt jetzt **„Einstellungen“** (weiterhin nur für Admins); die Hinweise in den
  Sitzungen sprechen ebenfalls von den „Einstellungen“.
- **Einführung zum Ablauf startet einmal neu** (Ablauf ansehen und Ablauf bearbeiten), weil der Ablauf zuletzt umgebaut
  wurde. Die Termine-Einführung erwähnt die Ablaufvorlagen im „⋯“ und bleibt sonst, wie sie ist.

### Behoben (Musik-App)

- Am Handy lag das Blatt von unten (das „⋯“-Menü und die Auswahl „Kommende ⌄“ in den Terminen) hinter der Reiterleiste
  und war halb verdeckt. Es liegt jetzt wieder darüber.

### Intern

- Neuer Quelltext-Wächter `ui/design/einstellungenReiter.test.ts` (R13): kein Reiter heißt „Mehr“ oder „Verwaltung“,
  „Einstellungen“ ist in jeder Reiter-Liste der letzte. Design-System: R13 neu, bei R3 die Ausnahme für `gefahr`-Knöpfe
  (roter Rand erlaubt, wie in ChurchTools).
