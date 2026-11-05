### Behoben (Musik-App)

- **Keine Schrift-Fehler mehr in der Konsole** (#849). Vite bettete zwei kleine Lato-Dateien (Namen mit ł, č …) als
  `data:` ins CSS ein, die Sicherheitsregel der App blockierte sie bei jedem Start. Sichtbar war nichts, weil der
  Browser die woff2-Fassung nimmt – die Schriften liegen jetzt immer als eigene Dateien vor.

### Geändert (Anmeldungen)

- **Das öffentliche Formular erlaubt keine eingebetteten Schriften mehr** (`font-src 'self'` in der `.htaccess`).
  Es lädt Lato wie die Musik-App als eigene Dateien; die Regel braucht `data:` nicht mehr.
