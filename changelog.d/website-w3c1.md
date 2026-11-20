### Neu (Website)

- **Neue Bedien-Schicht in der Vorschau (W3c-1, am Computer).** Fährt man über einen Abschnitt, steht seine **Leiste auf der Oberkante**
  (Griff · nach oben · nach unten · Gestalten · kopieren · löschen), über einem Baustein **eine** helle Leiste mit dem Stift (öffnet das bisherige
  Fenster), unten mittig die **Abstand-Pille** (öffnet „Gestalten“), an der Grenze zweier Abschnitte **Abschnitt einfügen**, in einer Lücke zwischen
  Bausteinen ein **+**. Alles hell mit Rand und Schatten – auf weißem, sanftem und dunklem Hintergrund gleich gut zu lesen. **Nie über Text und nie
  übereinander:** Eine Kollisionsregel (Rangordnung, Ausweichen, Ausblenden; `ebene.kern.txt`, mit Tests) sucht jedem Element einen freien Platz. Der Griff
  verschiebt vorerst mit den Pfeiltasten; das Ziehen kommt mit W3c-2. Am Handy bleibt alles wie bisher: Fenster.
- **Text direkt tippen.** Überschrift, Akzentzeile, Text (auch in Bild+Text) und die Beschriftung eines Knopfes lassen sich in der Vorschau anklicken und
  an Ort und Stelle schreiben. Beim Markieren erscheint eine kleine Leiste: **fett, kursiv, Link, Liste, Zwischenüberschrift**. Esc bricht ab; Klick daneben
  (bei Überschrift, Akzentzeile und Knopf auch die Eingabetaste) übernimmt – erst dann wird gespeichert, **während des Tippens wird nicht neu gezeichnet**.
  Eingefügtes ist immer reiner Text. Rückgängig/Wiederholen (Strg/Cmd+Z, Umschalt+Strg/Cmd+Z) gelten im Text. Geschrieben wird ohne den veralteten
  `execCommand`: Der Text wird als Blöcke gelesen und gezeichnet, Fett/Kursiv/Link/Liste rechnet der Kern.
- **Links prüft der Rahmen:** Die Adresse im Link-Feld geht an die Erweiterung und wird mit der echten Regel (dieselbe wie beim Rendern) geprüft;
  nicht erlaubt (zum Beispiel `javascript:`) → ruhiger Hinweis, kein Link.
- **Escape im Markdown:** Ein Backslash macht das folgende Zeichen zum Zeichen – `\*`, `\_`, `\[`, `\]`, `\(`, `\)`, `\\`, `\#`, am Zeilenanfang auch
  `\-` und `1\.`. **Getippter Text erscheint so exakt, wie er getippt wurde** (ein `*` oder ein `- ` am Zeilenanfang wird nicht mehr zur Formatierung);
  der Rückweg setzt die Backslashes selbst. Vorhandene Texte ohne Backslash rendern unverändert. Zusätzlich: `***text***` ist fett **und** kursiv.
- **Sicher:** Der getippte Text kommt nur an, wenn dasselbe Feld vorher als „wird getippt“ gemeldet wurde; „Eigenes HTML“ ist nie tippbar; Links mit
  ungültiger Adresse machen die ganze Nachricht ungültig; eine Formatierung, die sich nicht genau speichern lässt (zum Beispiel kursiv direkt neben
  fett ohne Leerzeichen), wird **nicht** übernommen – mit Hinweis, der Text bleibt. Ist die Seite von jemand anderem gesperrt, gibt es nur das Ansehen.

### Geändert (Website)

- Das Fenster „Baustein bearbeiten“ nennt unter dem Text den Backslash („Ein \ davor macht ein Sonderzeichen zum normalen Zeichen“).
- `?demo=seiten` (nur Entwickeln): „Unsere Gruppen“ hat jetzt Beispiel-Inhalt zum Ausprobieren (Text mit Fett, Link und Liste, dunkler Abschnitt, Eigenes HTML).
