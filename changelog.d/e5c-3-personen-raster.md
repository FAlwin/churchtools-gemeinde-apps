### Neu (Dienstplaner)

- **„Personen“ zeigt die Antworten aus „Wann kann ich?“.** In der Planer-Ansicht **Personen** ist jede Zelle nach der Antwort
  der Person gefärbt: **grün = Ja**, **gelblich = Vielleicht**, **rot schraffiert = Nein oder abwesend**, **weiß = keine
  Antwort**. Zugesagt-, angefragt- und Entwurf-Tags stehen unverändert davor, der rote Rahmen bei „abwesend, aber eingeteilt“
  bleibt. Die **Abwesenheit** aus ChurchTools schlägt eine Ja-/Vielleicht-Antwort am selben Termin.
- **Spaltenkopf mit Zahlen.** Unter Termin und Uhrzeit steht fett „5 ja · 1 vielleicht“ – gezählt werden **verschiedene
  Personen** im Raster (wer in zwei Diensten steht, zählt einmal; wer abwesend ist, nicht).
- **Legende** über dem Raster („Antwort der Person: Ja · Vielleicht · keine Antwort · Nein oder abwesend · Entwurf“); am Handy
  bricht sie um.
- **Notiz und „nur bestimmte Dienste“.** Die Notiz einer Antwort steht im Tooltip der Zelle („Ja – nur bis 12 Uhr“). Gilt eine
  Antwort nur für bestimmte Dienste, bleibt die Zelle in den anderen Diensten weiß, der Tooltip sagt es („Ja – nur für Gesang“);
  im Spaltenkopf zählt die Person trotzdem.
- **Wer sieht die Antworten?** Wer die Dienstgruppe planen darf und in ChurchTools das Recht „sehen“ auf den Speicher „Antworten …“
  hat. Sonst steht im Block „Antworten nicht sichtbar“ (keine Farbe). Scheitert das Laden nur vorübergehend, steht über dem Raster ein
  Hinweis mit „Erneut versuchen“ – die bisherigen Antworten bleiben stehen, nie wird daraus „keine Antwort“.

### Geändert (Dienstplaner)

- **„Abwesend“ ist in „Personen“ jetzt rot schraffiert** (vorher grau) – zusammen mit den neuen Farben für Ja und Vielleicht
  (neue Farbwerte `--antwort-*` in `ui/design`, hell und dunkel).
