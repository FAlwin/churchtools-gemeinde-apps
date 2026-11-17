### Doku (Protokolle)

- Anleitung `docs/betrieb/PROTOKOLLE.md` auf die erste Version v1.0.0 gebracht: Stand-Zeile ohne Verweis auf noch
  offene Etappen, Hinweis „Danach richtet ein Admin jede Gruppe ein“ bei der Installation, überholte Aussage zur
  Anwesenheit („später“) korrigiert, Hinweis auf den Planungsordner außerhalb des Repos.
- README: Protokolle stehen jetzt in der Tabelle „Die Apps“ und haben einen eigenen Abschnitt mit kurzem Rundgang
  (`docs/bilder/protokolle-demo.gif`, nur Beispieldaten). „In Arbeit“ nennt nur noch die Anmeldungen.

### Intern (alle Apps)

- `npm run readme-bilder -- <app>` nimmt jetzt nur die Bilder dieser App auf **und baut nur ihre GIFs** (vorher wurden
  danach alle GIFs aus den Rohvideos neu gebaut, also alle Binärdateien im Verlauf geändert); gestartet werden nur die
  passenden Dev-Server. Neu aufgenommen: der Protokolle-Rundgang samt Namensschild und Kurzfassung für die Übersicht
  (`apps-uebersicht.gif` entsteht nur beim Lauf ohne Filter) und die Standbilder der Protokolle für die
  README-Erinnerung; die Erinnerung (`readme-bilder.yml`) beobachtet jetzt auch `protokolle/**`.
