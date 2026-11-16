### Intern

- **Anmeldungen: das öffentliche Formular in Schritten** (Etappe F, Scheibe F2b; noch nicht freigegeben, veröffentlicht
  wird erst nach Etappe F). Nach dem abgenommenen Entwurf `f2-schritte-v1`, Klick-Runden 7 und 8:
  - Hat das Formular Schritte, zeigt es eine Seite nach der anderen – oben „Schritt 2 von 3 · Name“ und ein dünner
    Balken (übersprungene Schritte gestrichelt). „Weiter“ prüft nur die Pflichtfragen der Seite (`seiteFehlt`),
    „Zurück“ prüft nichts, die Antworten bleiben.
  - Die Fragen je Person stehen auf ihrer Seite für alle Personen; „+ Weitere Person“ und „Entfernen“ nur auf der
    ersten Seite mit Personen. Auswahl, Betrag, Datenschutz und „Anmelden“ am Ende der letzten Seite.
  - Gilt für das öffentliche Formular und die Vorschau; im Baukasten steht ein Schritt als Trennzeile mit Namen.
    Ohne Schritte sieht das Formular aus wie bisher.
  - Das Blättern steckt in `useSchritte` (die offene Seite merkt sich ihren Baustein; fällt sie weg, gilt die gezeigte
    davor), die Anzeige in `SchrittFortschritt`. `gezeigteSeiten` nimmt jetzt die schon gebauten Seiten an – sonst
    fand der Vergleich die offene Seite nicht.
  - Demo: Die Lobpreisfreizeit blättert („Mitarbeit“, „Team“ nur für Mitarbeitende).
