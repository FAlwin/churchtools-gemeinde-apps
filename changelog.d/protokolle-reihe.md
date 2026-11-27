### Neu (Protokolle)

- **Baustein „Reihe“:** Im Protokoll lässt sich eine Themen- oder Predigtreihe planen – **Einfügen ▾ → Reihe** (oder `/`). Je Abend eine Zeile mit Datum, ChurchTools-Event, Thema, Wer, Bibelstelle und Notiz; bei „Wer“ schlägt die Erweiterung die Mitglieder der Gruppe vor, ein freier Name geht auch. Die Reihe steht im Protokoll als Tabelle (am Handy als Karten) mit **Bearbeiten** und **In Events übertragen** – auch bei einem freigegebenen Protokoll.
- **In Events übertragen:** Das Fenster liest jedes Event frisch, zeigt je Event den neuen Text (Neues und Geändertes grün) mit Häkchen und Etikett (neu, geändert, darfst du nicht, ohne Event, zu lang, beschädigt) und schreibt mit einem Klick in die **Infos** der Events. Handtext, der schon in den Infos steht, bleibt stehen; die Reihe hat einen eigenen, markierten Abschnitt, der beim nächsten Mal ersetzt wird. Geht bei einem Event etwas schief, werden die anderen trotzdem übertragen.
- Ein Event kann nur zu einem Abend der Reihe gehören; wer ein Event wählt, übernimmt auch dessen Tag. Gibt es am Tag kein Event, steht dort „Kein Event“ – ein Event aus der Zeile neu anlegen kommt später.
- Bauen und übertragen darf, wer im Protokoll schreiben darf; die Infos eines Events ändern darf, wer dafür in ChurchTools das Recht hat (Kalender des Events) oder Admin des Events ist.
- **Ältere Fassung:** Wer eine ältere Fassung der Erweiterung offen hat, kann ein Protokoll mit Reihe nur lesen (nichts geht verloren) und sieht die Reihe dort nicht.

### Intern (Protokolle + Dienstplaner)

- Die Anbindung für „Weitere Infos“ eines Events ist von `dienstplaner/src/ladeTerminInfos.ts` nach `ui/ct/terminInfosPort.ts` gezogen und wird jetzt vom Dienstplaner und den Protokollen gemeinsam genutzt (kein Unterschied im Verhalten).
