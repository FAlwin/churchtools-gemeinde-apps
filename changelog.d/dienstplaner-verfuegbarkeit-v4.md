### Neu (Dienstplaner)

- **Abfrage bei „Nur abwesend“ mit „Fertig“:** Fragt deine Dienstgruppe nur nach Abwesenheiten, ist ein freier Termin keine Antwort. Die Karte auf dem Start sagt „Trag ein, wann du nicht kannst, und tippe auf „Fertig““, und die Mail ebenso. Die Karte und der Link in der Mail führen zu **Verfügbarkeit → Abwesenheiten**; dort steht über der Liste ein Band mit dem Knopf **„Fertig“**. Danach wird das Band grün („Danke! An allen anderen Terminen im Zeitraum kannst du. Ändern geht jederzeit.“); wer später noch Häkchen setzt, bleibt fertig. Bei vorgemerkten Häkchen steht „erst speichern“.
- **Wer fertig ist, bekommt keine Erinnerung mehr:** Nach „Fertig“ trägt sich die Person aus der Hilfsgruppe aus. Fertig ist auch, wer an allen Terminen der Abfrage abwesend ist. Der Stand im Fenster „Abfrage“, das Eintragen beim Start, der Abgleich und „Erinnern“ rechnen für „Nur abwesend“ genauso (Ja/Vielleicht zählen dort nicht).

- **„Einrichten …“ legt auch die Ablage „Antworten <Gruppe>“ an:** Das Fenster sagt vorher, ob sie angelegt wird oder schon da ist, und meldet sie nachher nachgelesen. Eine Abfrage bei „Nur abwesend“ startet nur, wenn die Ablage bereit ist – sonst steht da: „Für <Gruppe> fehlt die Ablage „Antworten <Gruppe>“ – erst „Einrichten …“ in den Einstellungen.“

### Intern (Dienstplaner)

- „Hat geantwortet“ liegt im eigenen Wert der Antworten-Ablage der Dienstgruppe (Feld `fertig`: Abfrage-ID → Zeitpunkt, kein „Ja“); alte Werte ohne das Feld bleiben lesbar, Speichern der Antworten und „Vertretung suchen“ erhalten es. „Offen“ je Art steht an einer Stelle (`beantwortetNach`).
