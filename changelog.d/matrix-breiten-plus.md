### Geändert (Dienstplaner – Durchklicken Alwin, 29.10.2026)

- **Nur noch zwei Spaltenbreiten, als Symbole:** Statt „S | M | L“ stehen oben zwei Symbole – **schmal** (vier Spalten
  im Rahmen, 176 px wie bisher M) und **breit** (zwei Spalten, 256 px wie bisher L). Beim Zeigen steht der Name dabei.
  S fällt weg: Dort waren die Titel im Ablauf abgeschnitten. Ein gemerktes S oder M wird „schmal“, L wird „breit“.
  Entwurf `e6-6-breiten-plus.html`.
- **Das grüne Plus in der Zeile „Ablauf“ ist kleiner:** 26 px statt voller Knopfhöhe – so groß wie Zauberstab und Regler
  der Dienstgruppen. Vorher füllte es die Zeile ganz aus („zu groß und nicht schön“).

### Intern (Spaltenbreite/Plus)

- `SPALTENBREITE` heißt jetzt `{ schmal, breit }`; `leseAnsicht` übernimmt gemerkte S/M/L-Werte.
- `Segment`: Optionen können einen `name` tragen (Screenreader und Tooltip) – für Optionen, die nur ein Symbol zeigen.
- `KopfKnopf` kann `klein` (nur Symbol, 26 px); `HinzufuegenMenue` reicht es durch (statt `nurSymbol`).
- Neue Symbole `spalten-schmal` und `spalten-breit`.
