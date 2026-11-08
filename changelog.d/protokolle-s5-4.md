### Neu (Protokolle, S5-4)

- **Punkte vorschlagen** (Entwurf `s5-4-vorschlaege-v1`, Alwin 06.11.2026): Im Reiter „Sitzungen“ steht bei „Kommend“
  **„Punkt vorschlagen“** – für alle in der Gruppe. Man wählt die Sitzung (vorbelegt die nächste), ein Thema und
  freiwillig ein, zwei Sätze. Ist noch keine Sitzung festgelegt, gilt er **„für die nächste Sitzung“** und rutscht von
  selbst dorthin, sobald die Leitung eine festlegt.
- **Karte „Vorschläge“** unter „Kommend“: alle Vorschläge der Gruppe, nach Sitzung geordnet, mit Stand (offen,
  übernommen, im Protokoll, abgelehnt mit Begründung); in der Sitzungszeile steht „2 Vorschläge“. Eigene, offene
  Vorschläge lassen sich **ändern und zurückziehen**.
- **Gruppe „Vorschlagen“:** Die Leitung sieht beim Schreiben oben **„Vorschläge · n“** mit **Übernehmen** (der Punkt
  kommt vor „Verschiedenes“, sonst ans Ende), **Nächstes Mal** (zur Sitzung danach) und **Ablehnen** (Begründung
  freiwillig). Übernehmen geht auch schon in der Karte – eingefügt wird dann beim Öffnen des Protokolls.
- **Gruppe „Direkt eintragen“:** Beim Öffnen des Protokolls stehen die Vorschläge schon als Punkte vor „Verschiedenes“;
  ein Hinweis sagt es. Die Leitung ändert, verschiebt oder löscht sie wie jeden Punkt.
- Unter einem übernommenen Punkt steht kursiv **„vorgeschlagen von …“** – auch beim Lesen und später im PDF; die
  Leitung kann es wie jeden Text ändern.

### Intern (S5-4)

- Regel `shared/protokolle/vorschlaege.ts` (Ziel einer Sitzung über `gehoertZu`, Weiterrutschen, Karte, Einfügestelle);
  ein Wert je Vorschlag in „Mitarbeit“ (`art: 'vorschlag'`), nie hart gelöscht.
- Im Protokoll trägt der Punkt die Block-ID `vorschlag-<ID>`: Erst wird eingefügt und **gespeichert**, dann „im
  Protokoll“ vermerkt – scheitert das Vermerken, erkennt das nächste Öffnen den Punkt und fügt ihn nicht doppelt ein.
- Ein Weg für alle Werte in „Mitarbeit“: `protokolle/src/mitarbeitWerte.ts` (frisch lesen, anwenden, schreiben,
  nachlesen) – To-Dos und Vorschläge nutzen ihn; Sitzungsliste und Editor lesen „Mitarbeit“ einmal für beides.
- Neues Symbol `idee` (Glühbirne) in `ui/icons`.
