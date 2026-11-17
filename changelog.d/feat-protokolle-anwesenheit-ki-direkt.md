### Neu (Protokolle)

- **Anwesenheit: eine Person aus diesem Protokoll nehmen.** Ein Gemeinschaftskonto oder jemand, der nie dabei ist, steht
  als Gruppenmitglied in jedem Gruppentreffen – und damit in jeder Anwesenheit. Jetzt hat jede Zeile einen kleinen Knopf
  **„… aus dem Protokoll nehmen“** (Auge-durchgestrichen). Gespeichert wird das **nur im Protokoll** (`props.ohne` am festen
  Punkt); im ChurchTools-Gruppentreffen bleibt die Person unverändert stehen. Unter der Liste steht dann
  **„n ausgeblendet · Zeigen“**, dort holt **„Zurückholen“** sie wieder herein. Ausgeblendete erscheinen weder in den
  Zahlen und der Kurzform noch beim Lesen und im PDF; sie zählen im Fenster „Protokoll freigeben?“ nicht als „noch
  offen“, und die automatische Vorbelegung schreibt ihnen nichts ins Gruppentreffen. Auch bei abgeschlossenem
  Gruppentreffen möglich, weil es nur das Protokoll betrifft.
- **Mit KI füllen: direkt zur Antwort.** Wer die Antwort der KI schon hat, kommt in Schritt 1 über **„Antwort schon da?
  Direkt einfügen“** ohne Transkript zu Schritt 2 (dort ohne „Auftrag anzeigen“; „Zurück“ geht weiter).
- **Mit KI füllen: Platzhalter zuordnen.** Kommen in der eingefügten Antwort Platzhalter wie `[Person 1]` vor, die das
  Fenster nicht kennt (Antwort aus einem früheren Lauf), erscheint in Schritt 2 die Liste **„Platzhalter zuordnen“**: je
  Platzhalter ein Feld für einen Namen, mit den Gruppenmitgliedern als Vorschlag. Leer lassen = der Platzhalter bleibt
  stehen. Ein gewähltes Mitglied wird bei To-Dos zur zuständigen Person. In der Vorschau sagt ein Hinweis oben, welche
  Platzhalter noch keinem Namen zugeordnet sind („nach dem Übernehmen selbst ersetzen“).

### Geändert (Protokolle)

- **Mit KI füllen: ein unzugeordneter Platzhalter ist kein Zuständiger mehr.** Stand in der Antwort bei einem To-Do
  `[Person 3]` als Zuständiger und kannte das Fenster ihn nicht, wurde er als **externer Name „[Person 3]“** übernommen.
  Jetzt bekommt das To-Do niemanden („niemand zuständig“), und der Hinweis in der Vorschau nennt den Platzhalter.

### Intern

- `shared/protokolle/anwesenheit.ts`: `ohneAus` / `ohneWert` (Lesen und Schreiben von `props.ohne`) und
  `ohneAusgeblendete` – die EINE Stelle, die Ausgeblendete aus dem `TreffenStand` nimmt (Anwesenheit, `protokollBlatt`,
  `freigabeHinweise`, `vorbelegung`/`vorbelegen`). `vorbelegung` und `vorbelegen` bekommen `ohne` als Pflichtparameter,
  damit keine Stelle es vergisst.
- `shared/protokolle/platzhalter.ts`: `PLATZHALTER_MUSTER`, `platzhalterIn`, `unzugeordnet`, `zuordnungErgaenzen`;
  `shared/protokolle/ki.ts`: `offenePlatzhalter`, `Eintrag.offen` am To-Do.
