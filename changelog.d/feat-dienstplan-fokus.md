### Neu (Dienstplaner)

- **Planen: Fokus-Modus – eine Person im ganzen Plan anleuchten.** Alle Einsätze einer Person werden in der Matrix, auf dem
  Handy-Zettel und in „Personen“ **gelb umrandet** (Rahmen außen, blasse Fläche – grün, „?“ und blau gestrichelt im Platz
  bleiben sichtbar). Oben steht die **Fokus-Leiste**: „Fokus: Daniel F. · 5 Einsätze in 5 Terminen · 1 angefragt · 1 Entwurf“
  mit „Fokus aus“. Ausgeblendete Dienste zählen mit („· 1 ausgeblendet“), abgesagte Termine nicht.
  - **Vier Wege hinein:** das **Fokus-Symbol** am Namen eines belegten Platzes (am Rechner beim Darüberfahren, am Handy
    **lang drücken**), der Knopf **„Im Plan hervorheben“** im Fenster eines belegten Platzes, das Suchfeld **„Person
    hervorheben“** in der Werkzeugleiste (am Handy hinter einem Such-Symbol) und „Personen“: Name antippen.
  - **„Wer kann?“** zeigt je Kandidat in einer Mini-Zeile seine Einsätze eine Woche vor und nach dem Termin. **„im Plan
    zeigen“** schließt das Fenster und stellt die Person in den Fokus; die Leiste führt mit **„Zurück zu ‚Wer kann?‘“** zum
    selben Platz zurück und kann mit **„Hier eintragen“** gleich den Entwurf anlegen.
  - Der Fokus bleibt beim Wechsel zwischen Matrix, „Personen“ und „Wer wie oft?“ und beim Blättern; er endet mit „Fokus aus“
    oder beim Verlassen von Planen und wird nicht gemerkt. Immer nur eine Person; Gäste und verborgene Namen lassen sich nicht
    anleuchten.
  - In „Personen“ ersetzt der Fokus das Festhalten per Antippen: kräftig gelb statt blassem Blau; das Hover mit der Maus bleibt.
  - Technik: Die eine Regel „wer steht an diesem Platz“ steht in `shared/dienstplan/fokus.ts`, daraus rechnen Umrandung,
    Leiste, Suchvorschläge und Mini-Zeile. Neue Farben `--fokus`, `--fokus-grund`, `--fokus-text` in `ui/design/_farben.scss`.
