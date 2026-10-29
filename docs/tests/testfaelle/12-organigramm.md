# Organigramm

Die Erweiterung „Organigramm“ (Kürzel `organigramm`, Anleitung `docs/betrieb/ORGANIGRAMM.md`). Getestet wird in der
**Test-Instanz**, nie in der Live-Instanz der Gemeinde. Das Paket baut `npm run build -w organigramm` und
`npm run paket -w organigramm`; hochladen unter **Administration → Erweiterungen → Stift beim Modul → ZIP-Datei**.

### TF-ORG-01 · Präsentation am Laptop mit Beamer

**Das brauchst du:** Einen Laptop mit Chrome (oder Edge) und am besten einen Beamer oder zweiten Bildschirm. In der
Test-Instanz das Modul **Organigramm** mit dem aktuellen Paket.

**Das muss passieren:** Die Präsentation liegt über der ChurchTools-Leiste; mit **Vollbild** verschwinden auch die
Leisten des Browsers. Blättern geht mit der Maus und mit der Tastatur (wie mit einem Präsentations-Klicker).
Bereiche, die man nicht ganz sehen darf, heißen „Mitglieder nicht sichtbar“, nie „gesucht“.

1. In ChurchTools im Menü auf **Organigramm**, warten, bis die Personen im Baum stehen.
2. Oben rechts auf **Präsentieren**: Es erscheint „Unsere Bereiche“ mit einer Kachel je Bereich.
3. Oben auf **Vollbild**: Das Bild füllt den ganzen Bildschirm, ohne Adresszeile.
4. Mit **Pfeil rechts** (oder **Bild ab**, **Leertaste**) durch die Bereiche blättern; unten steht „1 von …“.
5. In einer Spalte auf **… Untergruppen** klicken: Die Untergruppen klappen mit ihren Personen auf.
6. **Pos1** springt zur Übersicht; **Esc** beendet zuerst das Vollbild, ein weiteres **Esc** geht zur Übersicht,
   noch eins schließt die Präsentation.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `organigramm/src/Praesentation.tsx`, `organigramm/src/Praesentation.module.scss`, `shared/organigramm/praesentation.ts`, `organigramm/src/App.tsx`
- **Automatisiert:** teilweise – `App.test.tsx` („O4: Präsentation“: Übersicht, Spalten, Tasten, ausgeblendete
  Typen, Vollbild-Knopf) und `praesentation.test.ts`; das echte Browser-Vollbild prüft nur dieser Fall
- **Historie:** #683 (Abnahme 22.10.2026: im Claude-Browserbereich ließ sich das Vollbild nicht prüfen – der lässt
  es nicht zu)

</details>

### TF-ORG-02 · Personen und Hinweise nur für die eigene Leitung

**Das brauchst du:** Zwei Konten in der Test-Instanz: ein Gruppen-Admin und eine Person, die nur **eine** Gruppe
leitet (z. B. Technik) und sonst nirgends Leitung ist.

**Das muss passieren:** Der Admin sieht die Reiter **Organigramm · Personen · Hinweise** für die ganze Gemeinde. Die
Leitung von Technik sieht dieselben Reiter, aber nur Personen und Hinweise aus Technik und ihren Untergruppen. Wer
nichts leitet, sieht nur den Baum – ohne Reiter.

1. Als Admin **Organigramm** öffnen: oben die drei Reiter; unter **Personen** stehen alle.
2. Als Leitung von Technik öffnen: unter **Personen** nur Leute aus Technik und den Gruppen darunter.
3. Unter **Hinweise** nur Gruppen und Personen aus diesem Bereich.
4. Als Person ohne Leitung öffnen: keine Reiter; auch die Adresse mit `#personen` am Ende zeigt nur den Baum.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/organigramm/sichtbereich.ts`, `organigramm/src/start.ts`, `organigramm/src/App.tsx`, `shared/organigramm/hinweise.ts`
- **Automatisiert:** teilweise – `sichtbereich.test.ts`, `hinweise.test.ts`, `App.test.tsx` (O3: Technik-Leitung,
  ohne Leitung); dass ChurchTools die Leitung wirklich so meldet, prüft nur dieser Fall
- **Historie:** #672 (Abnahme 22.10.2026 nur als Admin)

</details>

### TF-ORG-03 · Gruppe umhängen, Untergruppe anlegen – und zurück

**Das brauchst du:** In der Test-Instanz ein Gruppen-Admin-Konto und zwei Gruppen nur zum Üben (z. B. „Übung A“ und
„Übung B“, ohne Mitglieder). Nie in der Live-Instanz.

**Das muss passieren:** Umhängen, Lösen, eine weitere Obergruppe und eine neue Untergruppe kommen genau so in
ChurchTools an, wie das Fenster es sagt; „Rückgängig“ stellt den Stand vorher wieder her. Niemand bekommt dabei eine
Mail.

1. **Organigramm** öffnen, auf **Übung B** klicken. Unter „Gehört zu“ auf **＋ Unter eine Gruppe hängen** (bzw.
   **Ändern**), **Übung A** wählen: Das Fenster sagt vorher, wer danach was sieht. **Hinzufügen**/**Umhängen**.
2. Im Baum steht Übung B jetzt unter Übung A. In ChurchTools unter **Gruppen → Übung B → Gruppenhierarchie**
   nachsehen: dieselbe Obergruppe.
3. Im Fenster auf **Rückgängig**: Übung B steht wieder wie vorher – im Baum und in ChurchTools.
4. Bei **Übung A** auf **＋ Untergruppe anlegen**, Name „Übung C“, Typ lassen, **Anlegen**: Übung C steht im Baum unter
   Übung A, in ChurchTools mit Status „Aktiv“.
5. **Rückgängig**: Übung C ist in ChurchTools gelöscht.
6. Mit einem Konto, das nur eine Gruppe **leitet**, dieselbe Gruppe öffnen: keine Knöpfe zum Ändern oder Anlegen.
7. Danach im Postfach der Beteiligten (und im ChurchTools-Protokoll) nachsehen: keine Mail zu diesen Änderungen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `organigramm/src/GruppenFenster.tsx`, `organigramm/src/StrukturSchritte.tsx`, `organigramm/src/struktur.ts`, `shared/organigramm/struktur.ts`, `shared/organigramm/rechte.ts`
- **Automatisiert:** teilweise – `struktur.test.ts` (Regeln und Browser-Zugriff gegen nachgebaute Antworten),
  `rechte.test.ts`, `App.test.tsx` („O5“); ob ChurchTools wirklich so antwortet und keine Mail schickt, prüft nur
  dieser Fall
- **Historie:** #694 (O0-Messung 22.10.2026: keine Mails bis 14:32 UTC; die angekündigte Nachprüfung nach Ablauf der
  Mail-Warteschlange fehlt in der Messnotiz)

</details>

### TF-ORG-04 · Person aufnehmen, Rolle ändern, austragen – und zurück

**Das brauchst du:** In der Test-Instanz eine leere Übungsgruppe (z. B. „Übung Mitglieder“) und eine Testperson mit
einer eigenen Plus-Adresse (z. B. „Mara Messung“). Dazu ein Konto, das eine Gruppe nur **leitet**. Nie in der
Live-Instanz.

**Das muss passieren:** Was das Fenster meldet, steht genau so in ChurchTools; Austragen beendet die Mitgliedschaft
(sie bleibt in der Historie der Person), statt sie zu löschen. Niemand bekommt eine Mail.

1. **Organigramm** öffnen, die Übungsgruppe anklicken, **＋ Person aufnehmen**, „Mara“ suchen, wählen, Rolle lassen,
   **Aufnehmen**. In ChurchTools unter der Gruppe nachsehen: Mara ist dabei, mit dieser Rolle.
2. Bei Mara **Rolle** → „Leiter“ → **Ändern**: In ChurchTools ist sie Leiterin.
3. Bei Mara **Austragen** → **Austragen**: Sie verschwindet aus der Liste. In ChurchTools in Maras Person unter
   **Gruppen** steht die Mitgliedschaft mit Enddatum heute.
4. **Rückgängig**: Mara ist wieder dabei, ohne Enddatum.
5. Mit dem Konto, das nur eine Gruppe **leitet**, diese Gruppe öffnen: „＋ Person aufnehmen“ und „Rolle“ sind da,
   „Austragen“ nicht.
6. Postfach der Plus-Adresse und ChurchTools-Protokoll ansehen: keine Mail zu diesen Schritten.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `organigramm/src/GruppenFenster.tsx`, `organigramm/src/MitgliedSchritte.tsx`, `organigramm/src/mitgliedschaft.ts`, `shared/organigramm/mitgliedschaft.ts`, `shared/organigramm/rechte.ts`, `ui/ct/personen.ts`
- **Automatisiert:** teilweise – `mitgliedschaft.test.ts` (Regeln und Browser-Zugriff), `rechte.test.ts`,
  `personen.test.ts`, `App.test.tsx` („O6“); ob ChurchTools wirklich so antwortet, keine Mail schickt und was eine
  Leitung darf, prüft nur dieser Fall
- **Historie:** #709 (Messung 23.10.2026: Aufnehmen/Rolle/Beenden per `PUT`, `DELETE` löscht spurlos; kein
  Mail-Eintrag im Protokoll)

</details>

### TF-ORG-05 · Plan „neue Gliederung“ – zwei Admins gleichzeitig

**Das brauchst du:** In der Test-Instanz zwei Konten mit dem Recht „Gruppen verwalten“, in zwei Browsern (oder einem
privaten Fenster) angemeldet, und ein Konto, das eine Gruppe nur **leitet**. Nie in der Live-Instanz.

**Das muss passieren:** Der Plan gilt für alle Gruppen-Admins; gleichzeitiges Speichern überschreibt nichts.
ChurchTools selbst ändert sich nicht – keine Gruppe, kein Name, kein Status.

1. Admin A: Reiter **Neue Gliederung** → **Plan anlegen**. Der Baum sieht aus wie heute. Danach gibt Alwin in
   ChurchTools Admin B die Rechte auf die Kategorie „Plan“ (**Daten sehen**, **Daten anlegen, ändern, löschen**).
2. Admin A: **＋ Neuer Bereich** „Übung Plan“, eine Gruppe dort **einhängen**, eine andere **umbenennen**, eine dritte
   **im Plan archivieren**. Jede zeigt ihre Marke und „vorher …“.
3. Admin B: Seite neu laden, Reiter **Neue Gliederung** – derselbe Plan, „Gespeichert von A“.
4. Beide öffnen den Reiter. Erst A benennt eine Gruppe um, danach B (ohne neu zu laden) eine andere: Bei B steht
   „A hat den Plan inzwischen geändert …“, A's Änderung ist zu sehen. **Nochmal auf dem neuen Stand** → beide
   Änderungen sind im Plan.
5. In ChurchTools nachsehen: Gruppen, Namen, Obergruppen und Status sind unverändert.
6. Mit dem Konto, das nur eine Gruppe **leitet**: kein Reiter „Neue Gliederung“, auch nicht über `#gliederung` in der
   Adresse.
7. Admin A: Reiter **Organigramm** → **Präsentieren**: Sie beginnt mit „Neue Gliederung · …“ – „Übung Plan“ ist ein
   Bereich, die umbenannte Gruppe trägt den neuen Namen, die archivierte fehlt. Oben **Heute**: der Stand aus
   ChurchTools, zurück auf der Übersicht. Mit dem Konto, das nur **leitet**: kein Umschalter, nur „Heute“.
8. Admin A: **Plan verwerfen** → **Verwerfen**. Bei beiden (nach Neuladen) „Noch kein Plan“.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `organigramm/src/NeueGliederung.tsx`, `organigramm/src/PlanFenster.tsx`, `organigramm/src/plan.ts`, `shared/organigramm/plan.ts`, `shared/ct/versionierterWert.ts`, `organigramm/src/Praesentation.tsx`
- **Automatisiert:** teilweise – `NeueGliederung.test.tsx` (Bedienung, Konflikt, Fehler gegen den nachgebauten
  Speicher), `plan.test.ts` (Regeln und Speicher), `versionierterWert.test.ts`, `App.test.tsx` (Reiter nur für Admins; „O7-4“ Präsentation Neue Gliederung | Heute);
  ob ChurchTools die Kategorie-Rechte so durchsetzt und zwei echte Sitzungen sich so verhalten, prüft nur dieser Fall
- **Historie:** #719 (O7-1 Plan-Kern #721, O7-2 Reiter #722, O7-4 Präsentation)

</details>

### TF-ORG-06 · Umbau ausführen – einzeln, alle, zurück

**Das brauchst du:** In der Test-Instanz ein Konto mit „Gruppen verwalten“ und drei Übungsgruppen ohne echte
Mitglieder (z. B. „Übung A“, „Übung B“ mit „Übung B1“ darunter). Nie in der Live-Instanz.

**Das muss passieren:** Jeder Schritt steht danach genau so in ChurchTools; nichts wird gelöscht außer einer gerade
angelegten, leeren Gruppe bei „Rückgängig“. Niemand bekommt eine Mail.

1. **Neue Gliederung** → Plan: **＋ Neuer Bereich** „Übung Neu“, „Übung A“ dort einhängen, „Übung B“ umbenennen in
   „Übung B2“, „Übung B“ und „Übung B1“ im Plan archivieren.
2. **Umbau**: „Übung A umhängen“ wartet auf „Übung Neu“; „Übung B archivieren“ wartet, bis „Übung B1“ woanders hängt
   (hier: archiviert ist – dann ist sie aus dem Baum).
3. „Übung Neu“ **Ausführen**: In ChurchTools gibt es den Bereich. **Rückgängig**: Er ist wieder weg, im Plan wieder
   „neu“. Nochmal **Ausführen**.
4. **Alle offenen nacheinander ausführen** → **Ausführen**: Am Ende „… von … erledigt“, nichts offen. In ChurchTools:
   „Übung A“ unter „Übung Neu“, „Übung B2“ heißt so, „Übung B1“ und „Übung B2“ haben den Status „archiviert“.
5. ChurchTools-Protokoll und Postfach ansehen: keine Mail zu diesen Schritten.
6. Aufräumen: Übungsgruppen in ChurchTools löschen, **Plan verwerfen**.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `organigramm/src/Umbau.tsx`, `organigramm/src/umbauTexte.ts`, `organigramm/src/struktur.ts`, `shared/organigramm/umbau.ts`, `shared/organigramm/plan.ts`, `shared/organigramm/struktur.ts`
- **Automatisiert:** teilweise – `Umbau.test.tsx` (Bedienung gegen ein nachgebautes ChurchTools), `umbau.test.ts`,
  `plan.test.ts`, `struktur.test.ts` (Browser-Zugriff); ob ChurchTools wirklich so antwortet und keine Mail schickt,
  prüft nur dieser Fall
- **Historie:** #719 (Messung O7-3 24.10.2026: `PATCH` Name/Status, archivierte Gruppen fehlen in Liste und Hierarchie,
  Mitgliedschaften bleiben, keine Mail im Protokoll)

</details>

### TF-ORG-07 · Ansichten: Liste, „Anfangen bei“, „Hier anfangen“

**Das brauchst du:** Die Test-Instanz mit der Erweiterung, ein Konto, das den Baum sieht; Laptop und Handy.

**Das muss passieren:** Karten und Liste zeigen dieselben Gruppen wie ChurchTools; „Anfangen bei“ zeigt nur den
gewählten Teil; die gewählte Ansicht bleibt nach dem Neuladen.

1. **Organigramm** → **Liste**: oben der Name der Gemeinde, darunter die Bereiche offen, tiefere Gruppen zu („2
   Untergruppen“). Gruppen und Namen mit ChurchTools vergleichen.
2. Eine Gruppe mit dem Pfeil aufklappen, **Alle zuklappen**, **Alle aufklappen** – nur unter der Spitze ändert sich
   etwas.
3. Seite neu laden: Die Liste ist wieder da. Am Handy (ohne vorher etwas gewählt zu haben) beginnt die Erweiterung mit
   der Liste.
4. **Anfangen bei** → ein Bereich: Karten und Liste zeigen nur ihn. Zurück auf **Ganze Gemeinde**.
5. Eine Gruppe mit Untergruppen anklicken → **Im Organigramm hier anfangen**: Das Fenster schließt, die Gruppe ist oben
   und offen, sie steht in „Anfangen bei“. Bei einer Gruppe ohne Untergruppen fehlt der Knopf.
6. Den Gruppentyp der Spitze im Typ-Filter ausblenden: wieder die ganze Gemeinde, keine Fehlermeldung. Wieder
   einblenden – auch per Doppelklick auf den Typ: Es bleibt bei der ganzen Gemeinde.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `organigramm/src/Organigramm.tsx`, `organigramm/src/Liste.tsx`, `organigramm/src/App.tsx`, `organigramm/src/auswahl.ts`, `organigramm/src/GruppenFenster.tsx`, `shared/organigramm/ansichten.ts`
- **Automatisiert:** größtenteils – `App.test.tsx` (O7b-2), `Liste.test.tsx`, `auswahl.test.ts`, `ansichten.test.ts`;
  ob die Gruppen mit dem echten ChurchTools übereinstimmen und wie es am Handy aussieht, prüft nur dieser Fall
- **Historie:** #736 (Entwurf `o7b-ansichten-v1.html` abgenommen 26.10.2026; Startansicht am Handy Liste)

</details>

### TF-ORG-08 · Diagramme: von oben, von links, Mindmap

**Das brauchst du:** Die Test-Instanz mit der Erweiterung, ein Konto, das den Baum sieht; Laptop mit Maus und ein
Handy oder Tablet zum Zoomen mit zwei Fingern.

**Das muss passieren:** Die Diagramme zeigen dieselben Gruppen wie ChurchTools; Ziehen öffnet nie eine Gruppe; der
Blick bleibt beim Auf- und Zuklappen, wo er ist.

1. Im Gerät gemerkte Ansicht löschen (oder neues Browserfenster), **Organigramm** öffnen: Am Laptop kommt **Von oben**,
   am Handy die **Liste**.
2. **Von oben**, **Von links**, **Mindmap** nacheinander: Gruppen und Namen mit ChurchTools vergleichen (**Alle
   aufklappen**).
3. Ein **+** anklicken: Die Untergruppen erscheinen, der Blick bleibt stehen; **−** klappt wieder zu.
4. Auf einem Kästchen beginnen zu ziehen: Das Bild wandert, es öffnet sich **kein** Fenster. Ein einfacher Klick auf
   ein Kästchen öffnet das Gruppenfenster.
5. Mausrad und **−** / **+** zoomen um die Mitte bzw. den Mauszeiger, **Ganz zeigen** passt alles ein – kein Kästchen
   liegt unter den Knöpfen unten rechts. Am Handy mit zwei Fingern zoomen und mit einem ziehen.
6. Mit Tab durch die Kästchen: Ein Kästchen außerhalb des Bildes wird in die Mitte geschoben; Enter öffnet es.
7. **Anfangen bei** einem Bereich: Das Diagramm fängt dort neu an.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `organigramm/src/Diagramm.tsx`, `organigramm/src/leinwand.ts`, `organigramm/src/textBreite.ts`, `organigramm/src/Organigramm.tsx`, `organigramm/src/App.tsx`, `organigramm/src/auswahl.ts`, `shared/organigramm/ansichten.ts`
- **Automatisiert:** größtenteils – `Diagramm.test.tsx` (Klick, Tastatur, Ziehen, Zoomen, Blick), `leinwand.test.ts`,
  `App.test.tsx` (O7b-3), `ansichten.test.ts`; wie es mit echter Schrift aussieht und ob zwei Finger zoomen, prüft nur
  dieser Fall
- **Historie:** #736 (Entwurf `o7b-ansichten-v1.html` abgenommen 26.10.2026)

</details>

### TF-ORG-09 · Organigramm als PDF und drucken (Mac Chrome, Mac Safari, iPad)

**Das brauchst du:** Die Test-Instanz mit der Erweiterung; einen Mac mit Chrome und Safari und ein iPad.

**Das muss passieren:** Auf jedem Gerät entsteht dieselbe PDF: oben Logo, „Organigramm“, Gemeinde und Stand, unten
Gemeinde und Seitenzahl, dazwischen das Diagramm bzw. die Liste – in Lato, auf dem gewählten Papier. Quer bleibt beim
Drucken quer, am Rand stehen keine Adresse und kein Datum des Browsers.

1. **Organigramm** → **PDF / Drucken**: Die Vorschau zeigt das Blatt; Papier „Passend“ nennt darunter A4 quer oder hoch
   und die Schriftgröße.
2. Ansicht **Von oben**, Ausschnitt **Ganze Gemeinde** → **PDF öffnen**: Die PDF öffnet sich in einem neuen Tab und
   sieht aus wie die Vorschau (eine Seite, nichts abgeschnitten, Namen mittig in den Kästchen, Linien bis an die
   Kästchen). Von dort **drucken**: Das Druckfenster zeigt das Blatt in seiner Lage (quer bleibt quer).
3. Dasselbe mit **Mindmap** und **A3 quer**, dann **Liste** (läuft bei vielen Gruppen über mehrere Seiten – in der
   Vorschau blättern). **Herunterladen** speichert `Organigramm-…-<Datum>.pdf`.
4. **Logo der Gemeinde** abwählen: Das Logo verschwindet aus Vorschau und PDF.
5. ChurchTools auf **dunkel** stellen: Vorschau und PDF bleiben hell.
6. Alles an **Safari am Mac** und am **iPad** wiederholen (iPad: im neuen Tab „Teilen“ → „Drucken“ bzw. „In Dateien
   sichern“).

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `organigramm/src/PdfFenster.tsx`, `organigramm/src/BlattSeite.tsx`, `organigramm/src/blatt.ts`, `organigramm/src/DiagrammBild.tsx`, `organigramm/src/App.tsx`, `ui/teilen/svgSeitenPdf.ts`, `ui/teilen/pdfSchrift.ts`, `ui/teilen/sharePdf.ts`, `ui/ct/logo.ts`, `ui/design/_farben.scss`, `shared/organigramm/ansichten.ts`
- **Automatisiert:** teilweise – `PdfFenster.test.tsx` (Vorschau, Auswahl, Seiten in die PDF, Blättern, Logo,
  Fehler/Neuversuch, veraltete PDF verworfen), `blatt.test.ts` (Papier, Maßstab, Seiten), `svgSeitenPdf.test.ts`
  (Stile als Attribute, Grundlinie, Formate je Seite, Aufräumen), `pdfSchrift.test.ts`, `sharePdf.test.ts`,
  `logo.test.ts`, `ansichten.test.ts` (Stummel), `App.test.tsx` (O7b-4); was der Browser zeichnet und druckt, prüft
  nur dieser Fall
- **Historie:** #736; Messung `messung-o7b-4-2026-10-28.md`. Erst über das Druckfenster des Browsers gebaut; Safari
  druckte hoch statt quer und mit Adresse/Datum am Rand (Alwin, 28.10.2026) → eigene PDF, Entwurf
  `o7b-4-pdf-v1.html` abgenommen 28.10.2026

</details>

### TF-ORG-10 · Präsentation: Kacheln, von oben, von links, Mindmap

**Das brauchst du:** Die Test-Instanz mit der Erweiterung; Laptop (am besten am Beamer oder zweiten Bildschirm).

**Das muss passieren:** Der Umschalter ändert nur, wie eine Seite aussieht – Weiter/Zurück führt in jeder Ansicht
durch dieselben Seiten (Übersicht, dann die Bereiche).

1. **Präsentieren**: Oben steht **Kacheln · Von oben · Von links · Mindmap**, gewählt ist **Kacheln** (oder die zuletzt
   gewählte Ansicht).
2. **Von oben**: Die Übersicht zeigt die ganze Gemeinde als Diagramm. Nur die Bereiche lassen sich anklicken; ein Klick
   öffnet die Seite des Bereichs („1 von … · Name“ unten), dort ist sein Baum ganz aufgeklappt.
3. **Weiter**/**Zurück** und die Pfeiltasten blättern durch die Bereiche – auch in **Von links** und **Mindmap**.
4. Auf einer Bereichs-Seite **Kacheln** wählen: Dieselbe Seite zeigt die Gruppen als Spalten mit den Personen.
5. Im Diagramm ein **+/−** mit Tab ansteuern und die **Leertaste** drücken: Es klappt nur, die Seite bleibt.
6. **Ganz zeigen**: Nichts liegt unter den Knöpfen unten rechts. Mit Plan auch **Neue Gliederung | Heute** umschalten –
   am iPad quer bleibt die Leiste oben einzeilig, alle Knöpfe gleich hoch.
7. Präsentation schließen und wieder öffnen: Die zuletzt gewählte Ansicht ist wieder da.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `organigramm/src/Praesentation.tsx`, `organigramm/src/Diagramm.tsx`, `organigramm/src/DiagrammBild.tsx`, `organigramm/src/leinwand.ts`, `organigramm/src/auswahl.ts`
- **Automatisiert:** größtenteils – `App.test.tsx` (O7b-5: Umschalter, nur Bereiche klickbar, ganz offen, Blättern,
  gemerkte Ansicht, Leertaste), `Diagramm.test.tsx` (klickbar, Knopfstreifen gemessen), `leinwand.test.ts`
  (Streifen frei), `auswahl.test.ts`; wie es am Beamer aussieht, prüft nur dieser Fall
- **Historie:** #736; Variante „Seiten bleiben“ (Alwin, 28.10.2026, klickbares Muster); „Ganz zeigen“ verdeckte
  vorher das unterste Kästchen (Alwin, 28.10.2026)

</details>

### TF-ORG-11 · Personen im Diagramm und in der Liste

**Das brauchst du:** Die Test-Instanz mit der Erweiterung; Laptop. Eine Gruppe mit Leiter, Co-Leiter und mehreren
Mitarbeitern (z. B. ein Dienst-Team) und – wenn möglich – eine Gruppe, deren Mitglieder man nicht sehen darf.

**Das muss passieren:** Unter dem Namen stehen die Rollen und Personen genau so, wie ChurchTools sie für die Gruppe
führt – niemand fehlt, nichts ist dazu erfunden.

1. Reiter Organigramm, Ansicht **Von oben**: Rechts neben den Gruppentypen steht **Personen: Aus · Rollen · Alle**,
   gewählt ist **Aus** (oder die zuletzt gewählte). In **Karten** gibt es den Umschalter nicht.
2. **Rollen**: In den Kästchen steht unter dem Namen klein **LEITER**, **CO-LEITER** … mit den Namen; die Standardrolle
   (Mitarbeiter bzw. Teilnehmer) steht zuletzt als Zahl („6 Mitarbeiter“). Mit der Gruppe in ChurchTools vergleichen:
   gleiche Rollen, gleiche Personen.
3. **Alle**: Statt der Zahl stehen die Namen. Lange Namenslisten brechen nach einem Komma um, kein Name ist geteilt.
4. Kein Kästchen liegt über einem anderen, das runde **+/−** verdeckt keine Zeile; **Ganz zeigen** zeigt alles.
5. Dasselbe in **Von links**, **Mindmap** und **Liste** (dort eingerückt unter dem Gruppennamen).
6. Eine Gruppe ohne Leserecht zeigt „Mitglieder nicht sichtbar“.
7. Seite neu laden: Die Wahl ist wieder da. Bei 1280 px Breite bleibt die Leiste oben einzeilig.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/organigramm/personen.ts`, `shared/organigramm/ansichten.ts`, `organigramm/src/kastenPersonen.ts`, `organigramm/src/messung.ts`, `organigramm/src/DiagrammBild.tsx`, `organigramm/src/Diagramm.tsx`, `organigramm/src/Liste.tsx`, `organigramm/src/Organigramm.tsx`, `organigramm/src/auswahl.ts`
- **Automatisiert:** größtenteils – `personen.test.ts` (Reihenfolge der Rollen mit den gemessenen Rollen, Zahl,
  versteckte und unbekannte Rolle), `ansichten.test.ts` (alle drei Anordnungen mit unterschiedlich hohen Kästchen: keine
  Überlappung, Linien an der Namenszeile), `messung.test.ts` (Zeilen, Umbruch, Platz für +/−), `kastenPersonen.test.ts`
  (Sichtregel), `Diagramm.test.tsx` (Blick fängt bei anderer Wahl neu an), `App.test.tsx` (O7b-6), `auswahl.test.ts`;
  ob es mit echten Namen gut aussieht, prüft nur dieser Fall
- **Historie:** #736; Wunsch Alwin 28.10.2026 („ChurchTools abbilden … nichts weglassen oder hinzufügen“), Entwurf
  `o7b-6-7-v1.html`, entschieden 29.10.2026

</details>

### TF-ORG-12 · Personen in Präsentation und PDF

**Das brauchst du:** Die Test-Instanz mit der Erweiterung; Laptop (am besten am Beamer) und – für das PDF – Mac mit
Safari oder Chrome. Eine Gruppe mit Leiter und mehreren Mitarbeitern.

**Das muss passieren:** Präsentation und PDF zeigen die Personen genau wie der Reiter – und das PDF bleibt sauber.

1. Im Reiter **Personen: Rollen** wählen, dann **Präsentieren** und **Von oben**: Oben steht **Personen: Aus · Rollen ·
   Alle**, gewählt ist **Rollen**; die Kästchen zeigen die Rollen. In **Kacheln** gibt es den Umschalter nicht.
2. In der Präsentation **Alle** wählen, einen Bereich öffnen: Auch die Untergruppen zeigen ihre Personen. Präsentation
   schließen – im Reiter steht jetzt ebenfalls **Alle**.
3. Am iPad quer (oder 1024 px Fensterbreite ohne Vollbild-Knopf) bleibt die Kopfleiste einzeilig, auch mit **Neue
   Gliederung | Heute**.
4. **PDF / Drucken**: Das Häkchen **Personen** ist gesetzt; die Vorschau zeigt die Personen wie im Reiter. Häkchen weg →
   nur die Namen der Gruppen.
5. Im Reiter **Aus** wählen und das PDF-Fenster neu öffnen: Häkchen aus. Anhaken → die Rollen, Mitarbeiter als Zahl.
6. Ansicht **Liste**: Unter jeder Gruppe ihre Rollen, etwas eingerückt, vor den Untergruppen. Bei mehreren Seiten steht
   kein Gruppenname allein unten auf einer Seite.
7. **PDF öffnen** und drucken (Mac Safari, Chrome, iPad): Namen gut lesbar, nichts abgeschnitten, nichts überlappt.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `organigramm/src/Praesentation.tsx`, `organigramm/src/PdfFenster.tsx`, `organigramm/src/blatt.ts`, `organigramm/src/BlattSeite.tsx`, `organigramm/src/kastenPersonen.ts`, `organigramm/src/umbruch.ts`, `organigramm/src/messung.ts`
- **Automatisiert:** größtenteils – `App.test.tsx` (O7b-6b: Umschalter nur in Diagrammen, gemeinsame Wahl),
  `PdfFenster.test.tsx` (Häkchen nach Reiter, Stufe, Diagramm und Liste), `blatt.test.ts` (Personen-Zeilen, Umbruch,
  Einzug, kein Name allein am Seitenende), `umbruch.test.ts`, `kastenPersonen.test.ts`; wie es gedruckt aussieht und
  die Kopfleiste am echten iPad prüft nur dieser Fall
- **Historie:** #736; entschieden 29.10.2026 (Häkchen im PDF zeigt die Stufe des Reiters, Präsentation mit eigenem
  Umschalter und gemeinsamer Wahl)

</details>

### TF-ORG-13 · Farbe: Kachel in Diagrammen, Liste und PDF

**Das brauchst du:** Die Test-Instanz mit der Erweiterung; Laptop. Gruppen mit eigener Farbe und ohne (dann gilt die
Farbe des Gruppentyps).

**Das muss passieren:** Vor jedem Gruppennamen steht die Kachel, wie ChurchTools sie in der Gruppenliste zeigt –
gleicher Buchstabe, gleiche Farbe.

1. Reiter Organigramm, **Von oben**, **Von links**, **Mindmap** und **Liste**: Vor jedem Namen die Kachel; die Gemeinde
   an der Spitze hat keine. Mit der Gruppenübersicht von ChurchTools vergleichen (Gruppen → Übersicht): gleiche Farben.
2. In der Mindmap links und „von oben“ ohne Personen: Das runde **+/−** berührt keine Kachel.
3. **Personen: Rollen** – in der Liste beginnen die Personen genau unter dem Namen, nicht unter der Kachel.
4. **Präsentieren**, eine Diagramm-Ansicht: dieselben Kacheln.
5. **PDF / Drucken** (Diagramm und Liste), **PDF öffnen**: Kacheln farbig und abgerundet; Buchstabe, Name und Kachel auf
   einer Höhe – auch die Rollen- und Personen-Zeilen sitzen wie am Bildschirm.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `organigramm/src/DiagrammBild.tsx`, `organigramm/src/messung.ts`, `organigramm/src/Liste.tsx`, `organigramm/src/BlattSeite.tsx`, `organigramm/src/blatt.ts`, `shared/organigramm/farbe.ts`, `shared/organigramm/ansichten.ts`, `ui/teilen/svgSeitenPdf.ts`
- **Automatisiert:** größtenteils – `Diagramm.test.tsx` (Kachel, Farbe, Name dahinter; kein +/− auf einer Kachel in
  allen Ansichten, mit und ohne Personen), `Liste.test.tsx`, `PdfFenster.test.tsx`, `messung.test.ts`, `farbe.test.ts`,
  `ansichten.test.ts`, `svgSeitenPdf.test.ts` (Rundung, Messung am groß gezeichneten Blatt); wie es gedruckt aussieht,
  prüft nur dieser Fall
- **Historie:** #736; Wunsch Alwin 29.10.2026 („bunter … an den Gruppenansichten orientieren“), Entwurf
  `o7b-8-farbe-v1.html`, Variante A „Kachel“ gewählt

</details>
