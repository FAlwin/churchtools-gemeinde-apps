### Geändert (alle Apps)

- **Was in einem Umschalter gewählt ist, sieht man jetzt sofort: blau umrandet, zart blau hinterlegt, blaue Schrift**
  (Alwin, 30.10.2026: im Tempo-Fenster nicht gefunden, wo der sichtbare Puls an ist; Entwurf „Auswahl, Anzeige &
  Dateien“, Variante B). Vorher war das Gewählte nur eine Stufe heller grau – im Dunkeln kaum zu unterscheiden. Gilt
  für alle Umschalter aller Apps: Tempo-Fenster (Schläge je Takt, Sichtbarer Puls, Klick), Liederliste, Abwesenheiten,
  Dienstplaner, Protokolle-Suche, Anmeldungen. Volles Blau bleibt den Knöpfen, die etwas tun („66 in ChurchTools
  speichern“).

### Intern (alle Apps)

- `auswahlKnopfAn` setzt Rand `--blue`, Fläche `--blue-soft`, Schrift `--blue-ink`; der Farbwert `--seg-on` ist weg.
  Sechs Stellen hatten Rand und Schrift über dem Baustein selbst nachgezogen – die Zeilen sind entfernt. Der verbundene
  `Segment` (Dienstplaner) hat dafür einen durchsichtigen Rand. Wächter `ui/design/auswahlBlau.test.ts`.
