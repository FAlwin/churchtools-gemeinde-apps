### Neu (Protokolle)

- **„Mit KI füllen“ macht nichts mehr doppelt (W12).** Hat jemand in der Sitzung schon Text geschrieben, bekommt die KI diese Zeilen im Auftrag mit einer Kennung (`Z1`, `Z2` …;
  Namen darin werden wie im Transkript durch Platzhalter ersetzt). Sie wiederholt sie nicht mehr als Stichpunkt und nennt bei einem Beschluss, To-Do oder Termin, **welche Zeile er
  ersetzt** (`ersetzt`) oder unter welche er gehört (`nach`). In der Vorschau steht dazu „ersetzt „…““ mit **eigenem Haken** (Haken weg: Die Zeile bleibt, der Baustein kommt
  darunter), „kommt unter „…““, und ein Stichpunkt, der schon dasteht, ist **durchgestrichen, mit „steht schon da“ und von Anfang an abgewählt**. „Ausgewählte übernehmen“
  setzt den Baustein **an die Stelle der Zeile**, ersetzte Zeilen fallen weg – eine Zeile mit eingerückten Unterzeilen, eine inzwischen geänderte oder gelöschte Zeile bleibt
  unangetastet. Alles geschieht in **einem** Schritt: ein „Rückgängig“ macht die ganze Übernahme zurück. Ohne vorhandenen Text ist der Auftrag wie bisher. Regeln:
  `shared/protokolle/ki.ts` (`vorhandeneZeilen`, `namenSuchtext`, `antwortLesen`, `uebernahmePlanen`) und `shared/protokolle/doppelt.ts` (Wortvergleich).

### Geändert (Protokolle)

- **Beschluss, To-Do und Termin sind ruhiger (W12, „Stil A“).** Keine getönten Kästen mehr, sondern ein schmaler Farbrand links (Beschluss grün, Termin blau, To-Do grau) mit
  kleinem Etikett „BESCHLUSS“, blauem fettem Datum beim Termin und einem Kreis beim To-Do; Wer und Frist stehen leise ohne Rahmen. Im **Editor, in der Lese-Ansicht
  (hell und dunkel) und im PDF** sieht es gleich aus; Bausteine hintereinander rücken enger zusammen.
