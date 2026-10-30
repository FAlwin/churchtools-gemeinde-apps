### Neu (Dienstplaner, E6b-1 – Alwin, 30.10.2026)

- **„Ablauf zeigen“** in der Termin-Ansicht: der Ablauf ruhig im Vollbild – „wie ein Hintergrundbild am Handy“.
  Entwurf `e6b-anzeige.html`, abgenommen 30.10.2026.
  - Oben links die Uhr (Gemeinde-Zeit, läuft mit) und der Tag, rechts Titel, Beginn und Ende; darunter alle Punkte mit
    Zeit, Dauer, Titel, Zuständigen und den Infos der unter „Spalten“ gewählten Gruppen. Weggelassene Punkte fehlen.
  - Nichts hervorgehoben, nichts verstellbar: Die Schrift passt sich an, damit alles auf einen Blick passt (einspaltig,
    höchstens 1100 px breit); reicht es selbst klein nicht, wird gescrollt.
  - Farben folgen ChurchTools (hell oder dunkel). Nur **Vollbild** (wo der Browser es kann, auch Taste F) und
    **Schließen** (auch Esc); der Bildschirm bleibt an, solange die Anzeige offen ist.
  - Die Live-Steuerung bekommt später einen eigenen Knopf.

### Geändert (Dienstplaner)

- **„Ende“ heißt jetzt: wann der letzte Punkt des Ablaufs vorbei ist** – ohne „ca.“ (Alwin, 30.10.2026: „Ist ja klar,
  dass es nur so endet, wenn alles nach Plan läuft“). Vorher stand „Ende ca.“ mit dem Ende des Termins aus ChurchTools,
  das mit dem Ablauf nichts zu tun haben muss. Termin-Ansicht und „Ablauf zeigen“ rechnen wie der Balken „Ende“ der
  Matrix (`ablaufEnde`); ohne Ablauf steht kein Ende da. Die Startseite zeigt bei „Als Nächstes“ nur Tag und Beginn.

### Behoben (alle Erweiterungen)

- Wechselte die Breite über die Handy-Grenze (Handy quer drehen), baute die Seite sich neu auf – offene Fenster und
  Bearbeiten gingen zu. Der Rahmen hat jetzt mit und ohne Leiste unten denselben Aufbau.

### Intern (E6b-1)

- `useWakeLock` nach `ui/bedienung/` (Musik-App und Dienstplaner), neu `ui/bedienung/useVollbild.ts` – das Organigramm
  nutzt ihn für die Präsentation statt eigener Vollbild-Logik. `tagLang` in `shared/ct/datum.ts`.
- Gemeinsamer Wert `--ebene-vollflaeche` (2500) für alles, was die ganze Fläche über der Leiste von ChurchTools deckt
  (App-Vollbild, Präsentation, „Ablauf zeigen“) – vorher stand die Zahl an jeder Stelle selbst, und die Anzeige lag mit
  1000 unter der Leiste (1040, in der Test-Instanz gefunden). Wächter `ui/design/ebeneVollflaeche.test.ts`.
- Neuer Testfall TF-ABLAUF-13.
