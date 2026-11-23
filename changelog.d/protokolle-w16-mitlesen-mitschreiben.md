### Neu (Protokolle)

- **Mitlesen von selbst (W16):** Wer einen Entwurf offen hat und nicht selbst schreibt – in der Lese-Ansicht oder im Editor, während jemand anderes
  schreibt –, sieht neuen Text nach wenigen Sekunden, ohne etwas anzuklicken (alle 10 Sekunden statt bisher 30, und jetzt auch in der Lese-Ansicht).
  Pause, solange das Fenster verdeckt ist; freigegebene Protokolle werden nicht nachgeladen; die Seite springt dabei nicht.
- **Anwesenheit für alle lesbar (W16):** Das Protokoll merkt sich die Anwesenheit (wer, Name, anwesend/abwesend/offen) – beim Schreiben nach jedem Tipp
  und beim Freigeben. Wer die Anwesenheit in ChurchTools nicht sehen darf, sieht beim Lesen und im PDF diesen Stand statt „ChurchTools erlaubt dir das
  nicht“; wer sie sehen darf, sieht sie weiter live. Auch bei einem kurzen Aussetzer von ChurchTools gilt der gemerkte Stand, ohne Fehlermeldung.
- **Neue Stufe „Schreibt mit“ (W16):** In „Gruppe einrichten“ gibt es zwischen „Lesen + eigene To-Dos“ und „Leitung“ die Stufe **„Schreibt mit“** – für
  „schreib du bitte mit“. Sie schreibt Entwürfe (Editor, Anwesenheit, Mit KI füllen, Bausteine), beginnt Protokolle (auch nachtragen und „Neues
  Protokoll“) und übernimmt Vorschläge oder schiebt sie aufs nächste Mal. Freigeben, Löschen, Sitzungen festlegen oder bearbeiten, Vorschläge ablehnen
  und die Leitungsrechte bei To-Dos bleiben bei der Leitung. Beim Einrichten bekommt die Stufe das Schreibrecht auf die Protokolle und „Gruppentreffen
  durchführen“ (für die Anwesenheit). Der Vorschlag beim Einrichten bleibt wie bisher; jede Gemeinde stellt die Stufe je Gruppe selbst ein.

### Behoben (Protokolle)

- „Mit KI füllen“ fehlte im Editor, wenn es im Kopf sonst keinen Knopf gab (kein „Bearbeiten“, kein „Teilen“) – fiel mit „Schreibt mit“ auf.
- Mitlesen im Editor übernahm einen neuen Stand auch dann, wenn dessen Text gerade nicht vollständig lesbar war; jetzt wartet es auf den nächsten Abruf.

### Intern (Protokolle)

- „Darf schreiben“ und „ist Leitung“ sind getrennt: `shared/protokolle/zugang.ts` (`darfSchreibenIn`, `istLeitungIn`) ist die eine Stelle für Sitzungen,
  Editor, To-Dos, Startseite und Suche; die Einstellung einer Gruppe speichert je Rolle die Rolle an der Mitgliedschaft (`typ`). Mitlesen:
  `protokolle/src/useMitlesen.ts`; Anwesenheit: `schnappschussWert`/`zumLesen`/`nurSchnappschussAnders` in `shared/protokolle/anwesenheit.ts`.
  Demo: `?demo=mitschreiben`, `?demo=mitglied` liest die Anwesenheit aus dem Schnappschuss.
