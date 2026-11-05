### Geändert (Musik-App)

- **Das Docker-Image enthält nur noch, was zur Laufzeit gebraucht wird** (#849). Es wird in zwei Stufen gebaut;
  Vite, Vitest, ESLint & Co. stecken nicht mehr im ausgelieferten Image. Die CI baut und startet es bei jedem PR
  (Job „docker-start“: Gesundheit, Web-App, läuft als `node`, keine Entwickler-Pakete).
- **Neuer Schalter `TRUST_PROXY`** (#849): `an` (Standard, wie bisher) hinter einem Reverse-Proxy, `aus` ohne. Die
  einfache Vorlage `deploy/docker-compose.yml` (Port im LAN, kein Proxy) setzt `aus` – sonst konnte jedes Gerät im
  WLAN eine erfundene Absender-Adresse mitschicken und das Login-Limit umgehen. Bestehende Installationen ändern sich
  nicht; wer die einfache Vorlage neu nimmt und später einen Proxy davorsetzt, stellt `TRUST_PROXY=an`.

### Behoben (Anmeldungen)

- **Das öffentliche Formular schickt Sicherheits-Header mit** (#849): Es darf nur die eigenen ChurchTools-Instanzen
  ansprechen, keine fremden Skripte laden und nur auf der eigenen Website eingebettet werden. Das Upload-Skript schreibt
  die `.htaccess` aus derselben Liste wie `instanzen.json`, prüft am Antwort-Kopf, dass der Webspace sie anwendet, und
  überschreibt nie eine fremde `.htaccess`. Für andere Gemeinden liegt `htaccess.beispiel` im Paket.

### Intern (alle Apps)

- GitHub-Actions mit Schreibrechten (Docker, Releases) stehen auf Commit-SHAs statt Tags; ein Test hält das fest. Die
  CI führt `npm audit --omit=dev --audit-level=high` aus.
