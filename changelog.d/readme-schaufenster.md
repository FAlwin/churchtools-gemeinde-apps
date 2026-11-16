### Intern (alle Apps)

- **README als Schaufenster:** oben Symbol, Download-Knopf und ein kurzer Rundgang durch alle vier veröffentlichten
  Apps als Animation, darunter die Apps in einer Tabelle (Zweck, Download, Anleitung) und je App ein eigener Abschnitt
  mit kurzem Video, den wichtigsten Punkten und Download-Link. Alle Bilder und Videos kommen aus den Demo-Modi
  (`docs/bilder/`, nur Beispieldaten). Die lange Funktionsliste der Musik-App steht aufklappbar darunter. Dabei
  korrigiert: Die Erweiterung kann inzwischen auch Abwesenheiten.
- **`npm run readme-bilder`** nimmt alle README-Videos und -Bilder neu auf: startet die nötigen Dev-Server (oder nutzt
  die dieser Arbeitskopie), spielt die Demo-Abläufe mit Playwright ab und baut mit `ffmpeg` die GIFs in `docs/bilder/`.
