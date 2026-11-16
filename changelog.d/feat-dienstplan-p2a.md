### Neu (Dienstplaner)

- **Personen: Eintragen per Klick in die Zelle.** Ein Klick in eine leere Zelle (Person × Termin im Block eines Dienstes)
  legt sofort einen **Entwurf** an – derselbe Weg wie die Wahl in „Wer kann?“, auf den ersten freien Platz dieses Dienstes
  an diesem Termin. Gesendet wird erst mit „Ansehen und senden“. Ein Klick auf den **eigenen Entwurf** nimmt ihn wieder weg.
  - **Ein Fenster kommt nur, wenn es etwas zu bedenken gibt:** die Person ist am selben Tag schon in einem anderen Dienst
    eingeteilt („Daniel F. ist am Fr, 20.11. schon bei Gesang eingeteilt. Trotzdem für Ton eintragen?“) oder an dem Tag
    abwesend (mit Grund und Zeitraum) – beides zugleich steht in einem Fenster, mit „Abbrechen“ und „Trotzdem eintragen“.
    Ist der **Dienst voll**, sagt ein Hinweis, dass „Platz dazunehmen“ im Moment über den Regler in der Matrix geht.
  - **Mit der Maus** zeigt eine leere, eintragbare Zelle beim Darüberfahren einen blauen Rahmen und ein „+“; am **Handy** steht
    in solchen Zellen ein blasses „+“. Jede dieser Zellen ist per Tastatur bedienbar. Eintragen lässt sich nur dort, wo es auch
    in der Matrix geht; bestehende Einteilungen anklicken tut noch nichts. Der Klick auf den Namen setzt weiter den Fokus.

### Intern (Dienstplaner)

- **Eine Regel für „freier Platz ohne Entwurf“** (`freiOhneEntwurf`): der Zauberstab und „Personen“ fragen dieselbe Funktion.
  Der Toast bei einem gescheiterten Eintragen/Entfernen („Hier hat eben jemand den Platz geändert …“) steht an einer Stelle
  (`fehlerHinweis`), ebenso das Entfernen eines Entwurfs (`entferneEntwurf`, fürs Entwurfs-Fach und „Personen“).

### Behoben (Dienstplaner)

- **„Personen“: Die Ecke „Name“ oben links bleibt sauber.** Scrollte am Handy eine abgesagte Spalte darunter durch,
  schien ihr Text durch „Name“ hindurch. Die Ecke lag nicht über den anderen Kopfzellen, weil eine allgemeinere Regel
  spezifischer war – jetzt `.raster thead .name` (wie die Ecke der Matrix, `.plan .svcKopf`).
