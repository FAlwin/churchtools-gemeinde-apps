### Geändert (Musik-App + Dienstplaner)

- **Info-Spalten als Tabelle** (Alwin, 02.11.2026: „Das mit den Spalten müssen wir irgendwie schöner hinbekommen“;
  Entwurf „Ablauf mit Info-Spalten“, abgenommen). Die Spalten haben keine feste Breite von 150 px mehr: Eine Spalte
  wird so breit wie ihr Inhalt (höchstens etwa 280 px, dann bricht der Text um), eine leere nur so breit wie ihr Name;
  der Punkt behält mindestens 380 px. Alle Zeilen teilen sich ein Raster – vorher rutschten die Spalten bei schmalerem
  Punkt nach links. Im Spaltenkopf steht, in wie vielen Punkten etwas eingetragen ist („Technik · 2“).
  - **Wird es eng** (iPad hochkant, viele Spalten), scrollt alles rechts vom Punkt waagerecht, der Punkt bleibt stehen.
    Rechts zeigt „›“, dass es weitergeht; steht in einer verdeckten Spalte etwas, trägt der Punkt ein Schildchen
    („Technik ›“), das dorthin scrollt.
- **Beim Bearbeiten stehen die Infos der gewählten Spalten unter dem Punkt** („Technik: …“) – vorher sah man dort
  nicht, was schon eingetragen war.
- **Die Kreise der Zuständigen sind antippbar** (Variante C): Ein Fenster nennt alle Personen mit ihrem Dienst, offene
  Dienste rot. Die Namen unter dem Titel bleiben. Bei Liedern öffnet der Punkt weiter das Blatt, die Kreise das
  Fenster.
- **Musik-App: nur Kürzel in den Kreisen** („in der eigenen App nur Initialen“). Auf dem eigenen Server blockte die
  Sicherheitsregel die Fotos aus ChurchTools – es blieb ein leerer Kreis. Im Dienstplaner (in ChurchTools) bleiben
  die Fotos; lädt eins nicht, steht das Kürzel da.

### Intern (Musik-App + Dienstplaner)

- `AblaufListe`: Punkt-Zelle (bei Liedern nur sie als Knopf, damit die Kreise ein eigener Knopf sein können), Spalten
  per `subgrid`, `useSpaltenSicht` misst verdeckte Spalten an den Köpfen; neu `ZustaendigeFenster`, `fotos`,
  `ResponsibleEntry.dienst`, `useAblaufBearbeiten({ infoSpalten })`. Gegenprobe: 20 Teile einzeln zurückgenommen,
  jeder macht Tests rot (die Matrix-Sonderregel für Infos war überflüssig – die schmale Form zeigt ohnehin nur den
  Titel – und ist entfernt). TF-ABLAUF-12, TF-EDIT-14.
