### Neu (Website)

- **Maße ziehen in der Vorschau:** Die **Spaltenbreite** lässt sich am Griff in der Lücke zwischen zwei Spalten ziehen – er rastet auf die
  Aufteilungen ein, die es für die Spaltenzahl gibt (bei zwei Spalten 1 : 1, 2 : 1, 1 : 2), gestrichelte Rastlinien und ein Chip „Aufteilung 2 : 1“
  zeigen es, die Seite folgt live. Bei drei und vier Spalten gibt es nur eine Aufteilung: Der Griff ist gedämpft und sagt, wo man die Spaltenzahl ändert.
- Der **Abstand** lässt sich an der Pille unten mittig ziehen („Abstand oben & unten: Normal“): senkrecht ziehen rastet auf Kein, Klein, Normal, Groß ein;
  gestreifte Bänder oben und unten zeigen die Höhe (auch auf dunklen Flächen sichtbar), der Chip nennt die Stufe. Es ist **ein** Wert für oben und unten.
  Ein Klick ohne Ziehen öffnet wie bisher „Gestalten“.
- **Esc** bricht beide Züge ab; mit Pfeil links/rechts am Spalten-Griff und Pfeil hoch/runter an der Pille geht es auch mit der Tastatur. Beide Änderungen
  sind Schritte für **Rückgängig/Wiederholen**. Redakteure dürfen beides, am Handy bleibt alles beim Fenster „Gestalten“.

### Intern (Website)

- Neue Nachrichten `aufteilung` (Abschnitt + Name aus `AUFTEILUNGEN`, nur mit der Spaltenzahl des Abschnitts) und `abstand` (Abschnitt + Stufe aus dem
  Schema), beide streng geprüft. Regeln an **einer** Stelle in `shared/website/bearbeiten.ts`: `aufteilungGleicheSpalten`, `aufteilungZiehen`,
  `gestaltungAendern` (nutzt auch das Fenster „Gestalten“). Die Rastung rechnet im Kern der Ebene (`ebene.kern.txt`) aus den Namen der Aufteilungen
  und den **am echten Stylesheet gemessenen** Pixelhöhen der Stufen (Probe-Abschnitte) – keine feste Liste im Skript.
