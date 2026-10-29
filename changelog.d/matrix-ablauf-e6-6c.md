### Geändert (Dienstplaner, E6-6c – Durchklicken Alwin, 29.10.2026)

- **Neuer Punkt in der Matrix ohne Blatt von unten:** Im Bearbeiten steht je Termin ein grünes **„+“** neben „N Punkte“
  in der Gruppenzeile „Ablauf“. Es klappt direkt darunter ein kleines Menü auf („Programmpunkt hinzufügen“, „Überschrift
  hinzufügen“) – wie „+ Eintrag hinzufügen“ in der Musik-App. Vorher stand „+ Punkt“ unter jedem Ablauf und öffnete auch
  am Rechner das Blatt „Option wählen“ über die ganze Breite unten am Bildschirm. Der neue Punkt landet wie in
  ChurchTools am Ende. Bei einem abgeschlossenen Ablauf steht statt des Plus das Schloss. Entwurf
  `e6-6-neuer-punkt.html` Variante A.
- **„Ablauf bearbeiten“ mit Wort, oben in der Leiste:** Statt des kleinen Stifts links neben „Ablauf“ steht oben neben
  S/M/L und Filter ein grauer Knopf **„Ablauf bearbeiten“** wie in der Musik-App; im Bearbeiten wird er zum blauen
  „Fertig“. Neben „Ablauf“ passte ein Knopf mit Wort nicht in die erste Spalte (178 px) – Alwin wollte lieber die Leiste
  als eine breitere Spalte. Er gilt weiter für alle gezeigten Termine, so bleibt das Ziehen zwischen Terminen. Am Handy
  bleibt alles, wie es ist.

### Intern (E6-6c)

- `useAblaufBearbeiten`: Mit `plusImKopf` liefert auch die schmale Form (`schmal`) ihren `kopfKnopf` – nur als Symbol,
  mit `plusName` als Namen („Eintrag hinzufügen – Gottesdienst, So, 01.11.“). Die Matrix stellt ihn per Portal an seinen
  Platz in der Gruppenzeile; Optionen, Sperr-Hinweis und Punkt-Fenster bleiben an EINER Stelle in der Liste. Das „+ Punkt“
  am Listenende ist entfernt (in der Matrix ist die schmale Form nie am Handy).
- `HinzufuegenMenue` kann `nurSymbol` und `title`. Den Leisten-Knopf liefert `AblaufBearbeitenKnopf` aus
  `MatrixAblauf.tsx` – dort steht auch die Regel, wer bearbeiten darf.
