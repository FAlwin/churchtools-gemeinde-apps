### Neu (Musik-App)

- **Filter in der Terminliste.** Neben „Kommende | Vergangene“ steht der Knopf „Filter“ (wie bei den Abwesenheiten):
  je Kalender ein Häkchen – ohne Häkchen verschwinden alle Termine dieses Kalenders, auch die mit Ablauf. Wo man Abläufe
  anlegen darf, holt das eingerückte Häkchen „auch ohne Ablauf“ zusätzlich die Termine ohne Ablauf in die Liste – mit
  „Anlegen“. So lässt sich z. B. spontan ein Ablauf für den Frauentreff anlegen, ohne die Liste der anderen zu ändern.
  Die Auswahl merkt sich das Gerät. Die Einführung der Termine zeigt den Knopf (einmal neu für alle).

### Geändert (Musik-App)

- **„Termine ohne Ablauf“ unter Mehr → Verwaltung ist weg** – das wählt jetzt jede Person selbst im Filter. Wer noch
  nichts gewählt hat, startet mit den Kalendern, die die Verwaltung bisher für alle eingestellt hatte. Das Suchwort
  (z. B. „Gottesdienst“) gibt es nicht mehr: „auch ohne Ablauf“ zeigt alle Termine des Kalenders ohne Ablauf, also auch
  einen Gebetsabend im selben Kalender. Termine ohne Ablauf sieht man nur noch aus Kalendern, in denen man Abläufe
  anlegen darf.

### Intern (Musik-App)

- `GET /api/services/ohne-ablauf?kalender=2,5` nimmt die Kalender aus der Anfrage (höchstens 50, gelesen über
  `songIdsFromQuery`) statt aus `SiteConfig.ablaufAnlegen`; das Feld bleibt nur als Startwert im Schema.
  `GET /api/kalender` braucht kein Admin-Recht mehr. Regeln in `client/src/utils/kalenderFilter.ts`, Recht je Kalender
  in `darfAblaufImKalender` (`shared/ct/ablaufRecht.ts`, auch von `darfAblaufBearbeiten` genutzt). `FilterKnopf` kann
  ein eingerücktes Zusatz-Häkchen und einen Hinweis. `brauchtAblauf`/`termineOhneAblauf` nehmen eine Kalenderliste.
