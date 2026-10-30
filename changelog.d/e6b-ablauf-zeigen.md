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

### Behoben (alle Erweiterungen)

- Wechselte die Breite über die Handy-Grenze (Handy quer drehen), baute die Seite sich neu auf – offene Fenster und
  Bearbeiten gingen zu. Der Rahmen hat jetzt mit und ohne Leiste unten denselben Aufbau.

### Intern (E6b-1)

- `useWakeLock` nach `ui/bedienung/` (Musik-App und Dienstplaner), neu `ui/bedienung/useVollbild.ts` – das Organigramm
  nutzt ihn für die Präsentation statt eigener Vollbild-Logik. `tagLang` in `shared/ct/datum.ts`.
- Neuer Testfall TF-ABLAUF-13.
