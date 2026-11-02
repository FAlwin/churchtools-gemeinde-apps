### Neu (Dienstplaner, E6b-2 L2 – Alwin, 02.11.2026)

- **„Live“ in der Termin-Ansicht** – der Live-Stand von ChurchTools zum Folgen, derselbe wie in dessen „Live-Agenda“
  (Ablaufpläne → „Live-Agenda ansehen“). Entwurf `e6b-2-live.html`, Variante A.
  - **Jetzt** mit Notiz (wie die Live-Agenda von ChurchTools), Zuständigen und den Infos der unter „Spalten“
    gewählten Gruppen, mitlaufende Lieder ohne Dauer, **Dann**, der Kreis mit der Restzeit (läuft ins Minus und wird rot: „+0:45 · über der Zeit“) und **Gesamt** mit der
    Abweichung in Worten („2 Min. später“). Darunter der ganze Ablauf: erledigte Punkte mit Haken, der aktuelle
    hervorgehoben, weggelassene durchgestrichen.
  - Folgt jedem Weiterschalten in ChurchTools nach spätestens 2,5 Sekunden – so oft fragt auch die Live-Agenda von
    ChurchTools. Nur solange „Live“ offen und sichtbar ist; gerechnet wird in der Uhr von ChurchTools, damit alle
    Geräte dieselbe Restzeit zeigen.
  - Noch nicht gestartet: „Jetzt · nach Plan“ folgt der Uhr. Nach dem letzten Punkt: „Ablauf vorbei“ mit Uhrzeit und
    Abweichung.
  - Antwortet ChurchTools kurz nicht, bleibt der letzte Stand stehen („Keine Verbindung – Stand von 10:08 Uhr. Wird
    wieder versucht.“).
  - Der Knopf steht an jedem Termin mit Ablauf (zum Vorbereiten); am Tag des Termins hat er einen roten Punkt, solange
    ChurchTools den Termin als gestartet führt. Bildschirm bleibt an, Vollbild wo möglich, Esc schließt.
  - Abweichung: Steht vor dem aktuellen Punkt ein weggelassener, rechnet die Live-Agenda von ChurchTools dessen Dauer
    mit ein, der Dienstplaner nimmt die Zeiten aus dem Ablauf (Test-Instanz: ChurchTools „−49 Minuten“, Dienstplaner
    „53 Min. später“ – laut Ablauf begann die Predigt um 12:50).
  - Steuern (‹ › − +) kommt mit L3. Testfall TF-ABLAUF-14.

### Geändert (Dienstplaner)

- **„Musik-App“ am Handy nur als Symbol** im Kopf des Ablaufs, im selben Kasten wie die Knöpfe daneben (Alwin,
  02.11.2026: „sieht sonst so komisch aus“). Am Rechner bleibt der Link mit Text.

### Intern (Dienstplaner)

- Der Demo-Ablauf hat eine ID wie in ChurchTools (die Live-Agenda braucht sie).
