### Geändert (Musik-App + Dienstplaner)

- **Einen Ablaufpunkt ansehen – wie in der ChurchTools-App.** Ein Tipp auf einen **Punkt** im Ablauf zeigt jetzt **alles** dazu:
  Uhrzeit, Dauer, Zuständige (offene Dienste rot), Bemerkung, Lied und die Infos je Dienstgruppe – mit **„Position 3/10“** und
  **Davor / Danach** zum Weiterblättern (Überschriften zählen nicht mit). Am **Handy** ist es eine eigene Seite („‹ Ablauf“ oben,
  Davor und Danach unten), am **iPad und Rechner** ein Fenster im Aussehen von „Punkt bearbeiten“, nur zum Ansehen. Ablauf-Ansicht
  der Musik-App und Termin-Ansicht des Dienstplaners zeigen dasselbe; die schmalen Matrix-Spalten des Dienstplaners bleiben, wie sie waren.
- **Gewohnheit: ein Lied hat zwei Tipp-Ziele.** Die **Lied-Karte** öffnet das Liedblatt (im Dienstplaner die Lied-Ansicht) wie bisher,
  ein Tipp auf den **Punkt** daneben – Uhrzeit, Titel, Namen – öffnet die Einzelansicht. Vorher war die ganze Zeile der Knopf zum Liedblatt.
  Hat ein Lied keine Angaben (Titel = Liedname, kein Ton, kein Tempo), steht der Liedname selbst als Karte da, damit der Weg zum
  Liedblatt bleibt. „Bearbeiten“ öffnet weiter „Punkt bearbeiten“ (unverändert); der blaue Streifen am Lied und der rote Hinweis
  „Moderation ?“ bleiben.
- **Gewohnheit (Musik-App): Teilen, Spalten, Vorlage und Co. liegen im „⋯“-Menü.** Im Ablauf bleibt oben **Bearbeiten** (grau), im
  Bearbeiten **Fertig** als einziger blauer Knopf und – am Rechner – das grüne **Eintrag hinzufügen** (am Handy der grüne Kreis). Neu im
  **⋯-Menü**: **Spalten wählen** (öffnet ein kleines Fenster mit Häkchen) und **Als PDF teilen** beim Ansehen; **Als Vorlage …**,
  **Neu aufsetzen …** und **Ablauf abschließen** beim Bearbeiten. Ist der Ablauf abgeschlossen, steht oben weiter der Knopf **Öffnen**.
  Der blaue **Stift** rechts an jeder Zeile entfällt im Bearbeiten: die Zeile selbst antippen öffnet das Fenster
  (im Dienstplaner seit dem Nachzug, siehe `feat-bedienung-ablauf-dienstplaner`).

### Intern

- Neue Bausteine in `ui/ablauf`: `PunktAnsicht` (Inhalt `PunktInhalt` + Hüllen `PunktAnsichtFenster`/`PunktSeite`), `usePunktAnsicht`,
  `liedMeta`; `InfoSpaltenFenster`; `AblaufListe` bekommt `onPunkt` (der Punkt ist ein Knopf **hinter** dem Inhalt, die Lied-Karte ein
  eigener Knopf davor). `useAblaufBearbeiten` kennt `linksImMenue`/`mehrOptionen` und `ohneStift`; `MehrMenue` bekommt `dataTour`.
  Das Schildchen „neu/geändert“ am Punkt ist ein `Etikett`. Einführung der Musik-App: Schritte „Lieder öffnen“, „Teilen und Spalten“
  und „Mehr: Abschließen, Vorlage, Neu aufsetzen“ angepasst, der Schritt „Als Vorlage“ ist darin aufgegangen.
