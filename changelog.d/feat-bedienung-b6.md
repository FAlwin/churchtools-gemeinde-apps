### Geändert (Protokolle)

- **Ruhigere To-Dos.** Statt vier Umschalter-Zeilen steht über der Liste **eine Werkzeugzeile**: links **Liste | Board** (am Handy
  der blaue Knopf „Liste ⌄“), rechts der **Filter** und der grüne Knopf **Neues To-Do**. Die Überschrift „To-Dos“ entfällt, sie
  steht schon im Reiter.
- **Gewohnheit: „Gruppieren“, „Sortieren“ und „Alle | Meine“ sind jetzt im Filter.** Im **Filter** stehen **Gruppieren nach**
  (im Board „Spalten nach“: Status, Fälligkeit, Person), **Reihenfolge** (Dringlichkeit, Bis-Datum, Alphabetisch, Manuell) und
  unter „Zuständig“ die Kurzwege **Alle** und **Nur meine**. Die Zahl am Filter zählt weiter nur, was ausgeblendet ist.
- **Ein grüner Knopf „Neu ⌄“ in den Sitzungen.** Statt vier Knöpfen in der Kopfzeile von „Kommend“, zwei davon grün, steht neben
  dem Gruppennamen **ein** grüner Knopf: **Neues Protokoll**, **Neue Sitzung**, **Punkt vorschlagen** und – hinter einer Linie –
  **Protokoll nachtragen**. Wer nur vorschlagen darf, sieht nur diesen Eintrag. Am Handy kommt das Menü als Blatt von unten.
  Nichts ist weggefallen, nur einen Klick tiefer.

### Intern

- `HinzufuegenMenue` kennt `pfeil` („Neu ⌄“) und `handy` (Blatt von unten, `AuswahlBlatt`), `KopfKnopf` einen Pfeil nach unten
  (`pfeil`); `WahlKnopf` ist entfallen (der Filter trägt die Wahlen). Obergrenze rohe Knöpfe Protokolle 82 → 81.
