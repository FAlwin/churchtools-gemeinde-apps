### Neu (Dienstplaner)

- **Die Personenliste lässt sich bearbeiten** (Scheibe PL-2, Entwurf `personenliste.html`, Variante B). Im „⋯“-Menü von Planen gibt es
  den neuen Eintrag **„Liste bearbeiten“** – er steht da, wo man die Liste mindestens einer gezeigten Dienstgruppe ändern darf
  (dieselben Rechte wie bei den Entwürfen) und wechselt bei Bedarf nach „Personen“. Im Modus steht unter der Werkzeugzeile ein blaues Band
  mit **„Tags verwalten …“** und **„Fertig“**. Alles gilt **für alle Planer der Dienstgruppe**.
  - **Reihenfolge:** Jede obere Zeile hat vor dem Bild einen **Griff**; am Griff ziehen (Maus, Finger, Tastatur) ordnet die Zeile im
    Block um und speichert die Reihenfolge der Dienstgruppe – sie gilt in allen Blöcken dieser Gruppe, in „Wer kann?“ und im PDF. Wer
    pausiert oder ganz abwesend ist (blass unten), hat keinen Griff.
  - **Personen-Fenster:** Im Modus öffnet der Klick auf einen Namen ein Fenster (immer in der Mitte, auch am Handy) mit den **Tags bei
    diesem Dienst** (Häkchen aus der festen Liste der Dienstgruppe) und der **Pause in der Dienstgruppe** (Keine · Bis Datum, einschließlich ·
    Ohne Ende). Ohne Tags führt ein Hinweis zu „Tags verwalten“.
  - **„Tags verwalten“:** Name und Kürzel (1–2 Zeichen, großgeschrieben) je Tag, „+ Tag“ legt einen an, das Kreuz löscht – ein gelöschter Tag
    verschwindet bei allen Personen. Die Dienstgruppe wählt man oben (nur Gruppen, die man ändern darf).
  - **Ohne Recht** in einer Gruppe gibt es dort keine Griffe, und der Name setzt weiter den Fokus. Ein Wechsel der Ansicht beendet den Modus.
  - **Wenn ein anderer Planer schneller war:** Nichts wird überschrieben; ein ruhiger Hinweis sagt es, der neue Stand ist geladen, das
    Fenster bleibt mit der Eingabe offen. Ein vorübergehender ChurchTools-Fehler verliert nichts und wiederholt nichts von selbst.
  - Angezeigt wird nur, was nach dem Speichern **nachgelesen** wirklich in ChurchTools steht.

### Intern (Dienstplaner)

- **Schreiben der Liste:** `personenlisteSpeichern` (`shared/dienstplan/personenlisteSpeichern.ts`, eigene Datei, weil `entwuerfe.ts` die Liste
  liest) – frisch lesen, Version vergleichen, anlegen (POST) oder ändern (PUT), doppelte Werte (zwei gleichzeitige POST) beim Schreiben mitlöschen,
  nachlesen, nie automatisch wiederholen; Gründe wie bei den Entwürfen (`abgemeldet`, `kein-recht`, `konflikt`, `voruebergehend`,
  `nicht-angekommen`, `zu-gross`). Gemeinsame Teile stehen nur einmal: Gewinner-Regel (`gewinnt`), `grundAus` und `schubladeLesen` in `entwuerfe.ts`,
  neu **`nachleseUrteil` in `shared/ct/modulDaten.ts`** (das Urteil nach dem Nachlesen: angekommen · Konflikt · sonst) – `entwurfSpeichern`,
  die Personenliste und der Baustein `versionierterWert` (Organigramm, Gebetsabend) rufen alle diese eine Regel auf. `Schubladeninhalt` nennt für die
  Liste den Wert (`listeWert`) und die Doppelten (`listeDoppelt`).
- **Reine Änderungen** in `shared/dienstplan/personenliste.ts`: `reiheSetzen`, `reiheNachZiehen`, `tagsSetzen`, `pauseSetzen`, `tagListeSetzen`
  (+ `tagKuerzel`, `neueTagId`). Sie setzen **absolute** Werte, damit ein Versuch, der doch angekommen ist, als „schon gespeichert“ erkannt wird,
  und liefern nur, was `personenlisteAus` wieder liest (Kürzel nie leer, Datum geprüft).
- Oberfläche: `useListeBearbeiten` (Modus, Rechte, Übernahme ins Raster), `PersonFenster`, `TagsVerwaltenFenster`, `ZiehZeile`; der Anschluss
  (`EntwurfAnschluss.personenliste`) und `useEntwuerfe.setzeListe` übernehmen die bestätigte Liste in die geladenen Daten.
- Die Demo (`?demo`) kann in die Schubladen von Musik und Technik schreiben – Reihenfolge, Tags und Pause lassen sich durchklicken.
