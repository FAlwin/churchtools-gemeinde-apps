### Neu (Dienstplaner)

- **Plätze-Fach: alle Dienste der Gruppe und „Vorlage übernehmen“.** Der Regler in der Gruppenzeile (Planen, auch am
  Handy) zeigt jetzt **jeden Dienst der Dienstgruppe**, den man am Termin planen darf – auch Dienste, die im gezeigten
  Zeitraum noch nirgends vorkommen (zum Beispiel „Abendmahl“): Sie stehen mit „nicht vorgesehen“ da, „+“ schaltet sie
  ein, „−“ bis 0 aus. Belegte Plätze und Dienste mit Entwürfen bleiben unverändert. Die Matrix bekommt keine
  Leerzeilen; nach dem Schließen lädt sie neu.
  - Oben im Fach steht „Vorlage übernehmen“ (nur Vorlagen des Kalenders des Termins, aus ChurchTools
    `/eventtemplates`): erst die Vorschau („Abendmahl: 0 → 1 · Musik: 3 → 5“, dazu was übersprungen wird und warum),
    dann „Übernehmen“. Die Vorlage **nimmt nur dazu** – nie weniger, nie ein Dienst weg, der Terminname bleibt – und
    wirkt über alle Dienstgruppen, wo man planen darf. Dienste mit Entwürfen am Termin werden übersprungen.
  - Jeder Dienst wird einzeln gespeichert (frisch lesen, schreiben, nachlesen); scheitert einer, laufen die anderen
    weiter, und die Meldung nennt, was geklappt hat und was nicht. Sind die Vorlagen nicht erreichbar, sagt das Fach es
    ruhig, die Plätze lassen sich trotzdem ändern.
  - Technik: Die Rechnung steht in `shared/dienstplan/vorlage.ts`, der Leser der Vorlagen in
    `shared/ct/terminVorlagen.ts`, die Gruppenzugehörigkeit teilen sich Matrix und Fach (`diensteDerGruppe`), „darf
    planen“ kommt für Dienste ohne Matrixzeile aus denselben Funktionen wie in der Matrix (`planbar`, `ganzSichtbar`).
