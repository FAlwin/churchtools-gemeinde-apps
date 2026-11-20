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
2. In der Werkzeugzeile auf **Präsentieren**: Es erscheint „Unsere Bereiche“ mit einer Kachel je Bereich.
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

1. Admin A: Reiter **Organigramm** → **⋯** → **Neue Gliederung** → **Plan anlegen**. Oben steht **‹ Organigramm**
   (zurück). Der Baum sieht aus wie heute. Am Handy zeigt die Reiterleiste unten kein „Neue Gliederung“ mehr, und
   „Kinder“ steht ohne Umbruch statt „Kinder & Jugend“. Danach gibt Alwin in
   ChurchTools Admin B die Rechte auf die Kategorie „Plan“ (**Daten sehen**, **Daten anlegen, ändern, löschen**).
2. Admin A: **＋ Neuer Bereich** (am Handy der schwebende grüne Kreis mit **+**) „Übung Plan“, eine Gruppe dort **einhängen**, eine andere **umbenennen**, eine dritte
   **im Plan archivieren**. Jede zeigt ihre Marke und „vorher …“.
3. Admin B: Seite neu laden, **⋯** → **Neue Gliederung** (oder die Adresse `#gliederung`) – derselbe Plan, „Gespeichert von A“.
4. Beide öffnen den Reiter. Erst A benennt eine Gruppe um, danach B (ohne neu zu laden) eine andere: Bei B steht
   „A hat den Plan inzwischen geändert …“, A's Änderung ist zu sehen. **Nochmal auf dem neuen Stand** → beide
   Änderungen sind im Plan.
5. In ChurchTools nachsehen: Gruppen, Namen, Obergruppen und Status sind unverändert.
6. Mit dem Konto, das nur eine Gruppe **leitet**: kein Eintrag „Neue Gliederung“ im **⋯**, auch nicht über `#gliederung` in der
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

1. **⋯** → **Neue Gliederung** → Plan: **＋ Neuer Bereich** „Übung Neu“, „Übung A“ dort einhängen, „Übung B“ umbenennen in
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

### TF-ORG-07 · Ansichten: Liste, „Bereich“, „Hier anfangen“

**Das brauchst du:** Die Test-Instanz mit der Erweiterung, ein Konto, das den Baum sieht; Laptop und Handy.

**Das muss passieren:** Karten und Liste zeigen dieselben Gruppen wie ChurchTools; „Bereich“ zeigt nur den
gewählten Teil; die gewählte Ansicht bleibt nach dem Neuladen.

1. **Organigramm** → Auswahlknopf **Ansicht** (links in der Werkzeugzeile) → **Liste**: oben der Name der Gemeinde, darunter die Bereiche offen, tiefere Gruppen zu („2
   Untergruppen“). Gruppen und Namen mit ChurchTools vergleichen.
2. Eine Gruppe mit dem Pfeil aufklappen, im **⋯**-Menü **Alle zuklappen**, **Alle aufklappen** – nur unter der Spitze ändert sich
   etwas.
3. Seite neu laden: Die Liste ist wieder da. Am Handy (ohne vorher etwas gewählt zu haben) beginnt die Erweiterung mit
   der Liste.
4. **Bereich** (Mitte der Werkzeugzeile, „Bereich: Ganze Gemeinde“) → ein Bereich: Karten und Liste zeigen nur ihn. Dann eine **tiefere Gruppe** (z. B. ein Café-Team):
   Nur sie und ihre Untergruppen sind zu sehen. In der aufgeklappten Liste sind die Gruppen nach Ebene eingerückt.
   **Suchen:** ein Stück eines Namens tippen – nur Treffer, darunter klein die Obergruppen; mit Pfeiltasten und Enter
   wählen (Laptop). Ein Name, den es nicht gibt → „Keine Gruppe gefunden“. **Am Handy:** Beim Aufklappen geht die
   Tastatur nicht von selbst auf, die Liste ist ganz zu sehen (ragt nicht über den rechten Rand), lässt sich
   scrollen, und die Seite rückt beim Aufklappen nicht zur Seite. Zurück auf **Ganze Gemeinde**.
5. Eine Gruppe mit Untergruppen anklicken → **Im Organigramm hier anfangen**: Das Fenster schließt, die Gruppe ist oben
   und offen, sie steht in „Bereich“. Bei einer Gruppe ohne Untergruppen fehlt der Knopf.
6. Als Gruppen-Admin über **Einstellungen** den Gruppentyp der Spitze für alle ausblenden und speichern (nur in der
   Test-Instanz): wieder die ganze Gemeinde, keine Fehlermeldung. Wieder einblenden und speichern: Es bleibt bei der
   ganzen Gemeinde.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `organigramm/src/Organigramm.tsx`, `organigramm/src/SpitzenAuswahl.tsx`, `ui/bedienung/menueLage.ts`, `organigramm/src/Liste.tsx`, `organigramm/src/App.tsx`, `organigramm/src/auswahl.ts`, `organigramm/src/GruppenFenster.tsx`, `shared/organigramm/ansichten.ts`
- **Automatisiert:** größtenteils – `App.test.tsx` (O7b-2), `SpitzenAuswahl.test.tsx`, `Liste.test.tsx`,
  `auswahl.test.ts`, `ansichten.test.ts`; ob die Gruppen mit dem echten ChurchTools übereinstimmen und wie es am Handy
  aussieht (Tastatur, Scrollen der Liste), prüft nur dieser Fall
- **Historie:** #736 (Entwurf `o7b-ansichten-v1.html` abgenommen 26.10.2026; Startansicht am Handy Liste); #915
  (11.11.2026: jede Gruppe mit Suche statt nur Bereiche)

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
7. **Bereich** wählen: Das Diagramm fängt dort neu an.

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
Gemeinde und Seitenzahl, dazwischen das Diagramm bzw. die Liste – in der PDF-Schrift (Gemeinde Sans, sieht aus wie Lato), auf dem gewählten Papier. Quer bleibt beim
Drucken quer, am Rand stehen keine Adresse und kein Datum des Browsers.

1. **Organigramm** → **⋯** → **PDF / Drucken**: Die Vorschau zeigt das Blatt; Papier „Passend“ nennt darunter A4 quer oder hoch
   und die Schriftgröße.
2. Ansicht **Von oben**, Ausschnitt **Ganze Gemeinde** → **PDF öffnen**: Die PDF öffnet sich in einem neuen Tab und
   sieht aus wie die Vorschau (eine Seite, nichts abgeschnitten, Namen mittig in den Kästchen, Linien bis an die
   Kästchen). Von dort **drucken**: Das Druckfenster zeigt das Blatt in seiner Lage (quer bleibt quer).
3. Dasselbe mit **Mindmap** und **A3 quer**, dann **Liste** (läuft bei vielen Gruppen über mehrere Seiten – in der
   Vorschau blättern). **Herunterladen** speichert `Organigramm-…-<Datum>.pdf`.
4. **Ausschnitt** → eine tiefere Gruppe über die Suche wählen: Die Vorschau zeigt nur sie samt Untergruppen; die
   aufgeklappte Liste liegt über dem Fenster und lässt sich scrollen, nichts ist abgeschnitten (#915).
5. **Logo der Gemeinde** abwählen: Das Logo verschwindet aus Vorschau und PDF.
6. ChurchTools auf **dunkel** stellen: Vorschau und PDF bleiben hell.
7. Alles an **Safari am Mac** und am **iPad** wiederholen (iPad: im neuen Tab „Teilen“ → „Drucken“ bzw. „In Dateien
   sichern“).

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `organigramm/src/PdfFenster.tsx`, `organigramm/src/SpitzenAuswahl.tsx`, `organigramm/src/BlattSeite.tsx`, `organigramm/src/blatt.ts`, `organigramm/src/DiagrammBild.tsx`, `organigramm/src/App.tsx`, `ui/teilen/svgSeitenPdf.ts`, `ui/teilen/pdfSchrift.ts`, `ui/teilen/sharePdf.ts`, `ui/ct/logo.ts`, `ui/design/_farben.scss`, `shared/organigramm/ansichten.ts`
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

1. Reiter Organigramm, Ansicht **Von oben**: **Filter** aufklappen: unter **Personen** stehen **Aus · Nur Rollen ·
   Alle**, gewählt ist **Aus** (oder die zuletzt gewählte). In **Karten** gibt es den Filter nicht.
2. **Nur Rollen**: In den Kästchen steht unter dem Namen klein **LEITER**, **CO-LEITER** … mit den Namen; die Standardrolle
   (Mitarbeiter bzw. Teilnehmer) steht zuletzt als Zahl („6 Mitarbeiter“). Mit der Gruppe in ChurchTools vergleichen:
   gleiche Rollen, gleiche Personen.
3. **Alle**: Statt der Zahl stehen die Namen. Lange Namenslisten brechen nach einem Komma um, kein Name ist geteilt.
4. Kein Kästchen liegt über einem anderen, das runde **+/−** verdeckt keine Zeile; **Ganz zeigen** zeigt alles.
5. Dasselbe in **Von links**, **Mindmap** und **Liste** (dort eingerückt unter dem Gruppennamen).
6. Eine Gruppe ohne Leserecht zeigt „Mitglieder nicht sichtbar“.
7. Seite neu laden: Die Wahl ist wieder da. Bei 1280 px Breite steht alles in **einer** Werkzeugzeile: Ansicht links,
   **Bereich** in der Mitte, **Filter**, **Präsentieren** und **⋯** rechts. Am Handy (390 px) zweizeilig, jedes Element mit Rahmen.
8. Am Handy (375 px), Ansicht **Liste**, mit einer zugeklappten Gruppe mit langem Namen (z. B. „Lobpreisteam“):
   „13 Untergruppen“ steht unter dem Namen, nichts überlappt, die Seite rutscht nicht zur Seite.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/organigramm/personen.ts`, `shared/organigramm/ansichten.ts`, `organigramm/src/kastenPersonen.ts`, `organigramm/src/messung.ts`, `organigramm/src/DiagrammBild.tsx`, `organigramm/src/Diagramm.tsx`, `organigramm/src/Liste.tsx`, `organigramm/src/Organigramm.tsx`, `organigramm/src/auswahl.ts`
- **Automatisiert:** größtenteils – `personen.test.ts` (Reihenfolge der Rollen mit den gemessenen Rollen, Zahl,
  versteckte und unbekannte Rolle), `ansichten.test.ts` (alle drei Anordnungen mit unterschiedlich hohen Kästchen: keine
  Überlappung, Linien an der Namenszeile), `messung.test.ts` (Zeilen, Umbruch, Platz für +/−), `kastenPersonen.test.ts`
  (Sichtregel), `Diagramm.test.tsx` (Blick fängt bei anderer Wahl neu an), `App.test.tsx` (O7b-6), `auswahl.test.ts`;
  ob es mit echten Namen gut aussieht, prüft nur dieser Fall
- **Historie:** #736; Wunsch Alwin 28.10.2026 („ChurchTools abbilden … nichts weglassen oder hinzufügen“), Entwurf
  `o7b-6-7-v1.html`, entschieden 29.10.2026; Schritt 8 seit #945 (16.11.2026: Zahl der Untergruppen überlappte am
  Handy den Namen)

</details>

### TF-ORG-12 · Personen in Präsentation und PDF

**Das brauchst du:** Die Test-Instanz mit der Erweiterung; Laptop (am besten am Beamer) und – für das PDF – Mac mit
Safari oder Chrome. Eine Gruppe mit Leiter und mehreren Mitarbeitern.

**Das muss passieren:** Präsentation und PDF zeigen die Personen genau wie der Reiter – und das PDF bleibt sauber.

1. Im Reiter über **Filter** **Personen: Nur Rollen** wählen, dann **Präsentieren** und **Von oben**: Oben steht **Personen: Aus · Rollen ·
   Alle**, gewählt ist **Rollen**; die Kästchen zeigen die Rollen. In **Kacheln** gibt es den Umschalter nicht.
2. In der Präsentation **Alle** wählen, einen Bereich öffnen: Auch die Untergruppen zeigen ihre Personen. Präsentation
   schließen – im Reiter steht jetzt ebenfalls **Alle**.
3. Die Kopfleiste hat zwei Zeilen: oben der Name der Gemeinde mit **Vollbild** und **Schließen**, darunter die
   Bedienung. Bei 1280 px steht der Name ganz da; am iPad quer und schmaler bricht nur die Bedienung um, nichts ragt
   über den Rand (seit #945, 16.11.2026 – vorher kürzte die einzeilige Leiste den Namen bis auf „Evange…“).
4. **⋯** → **PDF / Drucken**: Das Häkchen **Personen** ist gesetzt; die Vorschau zeigt die Personen wie im Reiter. Häkchen weg →
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

### TF-ORG-14 · Was das Organigramm für alle zeigt

**Das brauchst du:** Die Test-Instanz mit der Erweiterung; ein Konto mit „Gruppen verwalten“ und eins ohne (oder zwei
Browser). Die Rechte der Kategorie „Was das Organigramm zeigt“ sind gesetzt (sehen: alle; ändern: Gruppen-Admins).

**Das muss passieren:** Was ein Admin ausblendet, ist für alle weg – im Reiter, in der Präsentation, in der PDF – und in
ChurchTools ändert sich nichts.

1. Als Admin **Einstellungen**: Gruppentypen mit Zahl, darunter alle Gruppen als Baum mit Suche.
2. Einen Typ abwählen (z. B. Merkmal) und eine Gruppe mit Untergruppen: deren Untergruppen werden grau („mit der
   Obergruppe“). Unten steht „1 Gruppentyp und 1 Gruppe ausgeblendet“. **Speichern**.
3. Reiter Organigramm: Typ und Gruppe samt Untergruppen sind weg, oben steht „Für alle ausgeblendet: …“. Ebenso in
   **Präsentieren** und in **PDF / Drucken**.
4. Als Person ohne Admin-Recht (anderer Browser): dasselbe, ohne „Einstellungen“.
5. Zwei Admins gleichzeitig: Beide öffnen Einstellungen, A speichert, dann B – B bekommt „… hat das inzwischen
   geändert – nichts überschrieben“ und sieht den Stand von A.
6. Alles wieder einblenden und speichern: Der Hinweis verschwindet.
7. In ChurchTools nachsehen: Gruppen und Typen sind unverändert.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `organigramm/src/EinstellungenFenster.tsx`, `organigramm/src/sichtbarkeitSpeicher.ts`, `organigramm/src/speicher.ts`, `organigramm/src/App.tsx`, `organigramm/src/Organigramm.tsx`, `shared/organigramm/sichtbarkeit.ts`, `shared/organigramm/gruppen.ts`
- **Automatisiert:** größtenteils – `App.test.tsx` (O7b-7: Karten, Präsentation, PDF; ohne Leserecht; vorübergehend
  mit „Erneut versuchen“; kein Aufblitzen; nur Admins; Speichern mit Version; Konflikt), `sichtbarkeitSpeicher.test.ts`
  (gegen den nachgebauten Speicher), `sichtbarkeit.test.ts`, `gruppen.test.ts`; die Rechte der Kategorie und zwei echte
  Konten prüft nur dieser Fall
- **Historie:** #736; Wunsch Alwin 28.10.2026, Entwurf `o7b-6-7-v1.html`, entschieden 29.10.2026

</details>

### TF-ORG-15 · Welche Rollen: Personen nach Rollen filtern

**Das brauchst du:** Die Test-Instanz mit der Erweiterung; Laptop. Eine Gruppe mit Leiter, Co-Leiter, Organisator und
mehreren Mitarbeitern; ein Bereich mit Untergruppen, deren Leitung nicht die des Bereichs ist.

**Das muss passieren:** Abgewählte Rollen fehlen überall, wo Personen stehen – und es steht ehrlich da, was fehlt.
Niemand erscheint, der die Rolle nicht hat.

1. Reiter Organigramm, Ansicht **Liste**, **Filter** → **Personen: Aus**: Es gibt kein **Welche Rollen**. **Alle** →
   darunter erscheint **Welche Rollen** mit allen Häkchen.
2. Im Filter: ein Häkchen je Rolle, wie in ChurchTools benannt, Leitung zuerst; „Leiter“ steht nur einmal. Eine Rolle,
   die niemand hat, steht nicht da. Darunter **Alle** und **Nur Leitung**.
3. **Mitarbeiter** abwählen: Die Mitarbeiter fehlen, darunter steht klein „Mitarbeiter (6) ausgeblendet“. Der **Filter**
   zeigt die Zahl der abgewählten Rollen. Eine Gruppe, in der es nur Mitarbeiter gibt, zeigt nur den Hinweis.
4. **Nur Leitung**: nur Leiter und Co-Leiter. Dasselbe in **Von oben**, **Von links** und **Mindmap** – kein Kästchen
   liegt über einem anderen.
5. Seite neu laden: Die Wahl ist wieder da.
6. **Präsentieren**, **Kacheln**: oben **Welche Rollen** mit derselben Wahl. Einen Bereich öffnen: In den Spalten stehen
   nur die gewählten Rollen – auch die Leitung der Untergruppen –, darunter „N Personen ausgeblendet“. Die Zahl an der
   Spalte zählt weiter alle. Hier **Alle** wählen, Präsentation schließen – im Reiter steht jetzt ebenfalls **Alle**.
7. **PDF / Drucken** mit Personen: **Welche Rollen** übernimmt die Wahl des Reiters; hier geändert ändert sich nur die
   PDF, der Reiter bleibt.
8. Am Handy (oder 375 px breit): Das Menü ragt rechts nicht hinaus, die Seite rutscht nicht zur Seite.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/organigramm/personen.ts`, `shared/organigramm/praesentation.ts`, `organigramm/src/kastenPersonen.ts`, `organigramm/src/RollenAuswahl.tsx`,
  `organigramm/src/messung.ts`, `organigramm/src/blatt.ts`, `organigramm/src/Liste.tsx`, `organigramm/src/Organigramm.tsx`,
  `organigramm/src/Praesentation.tsx`, `organigramm/src/PdfFenster.tsx`, `organigramm/src/auswahl.ts`,
  `ui/bedienung/useMenueImBild.ts`
- **Automatisiert:** größtenteils – `personen.test.ts` (Name je Rolle einmal, Reihenfolge, ohne Personen nicht
  angeboten, Teilbaum-Regel), `praesentation.test.ts` (Spalten und Untergruppen, Zahlen zählen alle),
  `kastenPersonen.test.ts` (Hinweis, alles abgewählt, Knopftext), `RollenAuswahl.test.tsx` (Häkchen, Alle, Nur Leitung,
  Menü im Bild), `App.test.tsx` (Reiter, Diagramm, gemerkt, Präsentation mit Listen und Diagramm), `PdfFenster.test.tsx`
  (übernommen, nur für die PDF geändert); ob es mit echten Rollen gut aussieht, prüft nur dieser Fall
- **Historie:** #915 Scheibe B; Rückmeldung nach einer Vorstellung 11.11.2026, Entwurf und Entscheidungen 12.11.2026
  (Häkchen je Name, kleiner Hinweis im Kästchen, Präsentation Diagramme und Listen)

</details>

### TF-ORG-16 · Kinder & Jugend: Gruppenwechsel ansehen (Leitung und Bereichsleitung)

**Das brauchst du:** Die Test-Instanz mit der Erweiterung. Im Speicher der Erweiterung die Kategorie
„Gruppenwechsel“ mit einer Einrichtung (Stufen, Bereichsgruppe, Wechsel-Gruppen). Der Gruppentyp der Kindergruppen
gibt seinen Leitern: „Organigramm“ sehen, Kategorien und Daten sehen für „Gruppenwechsel“ und „Was das Organigramm
zeigt“, und den Kalender „Schulferien NRW“. Ein Admin-Konto und ein Konto, das nur eine Kindergruppe leitet (oder
zwei Browser).

**Das muss passieren:** Leitungen sehen nur ihre Gruppe, Admins und die Bereichsleitung alle Gruppen. Die Wechseltage
stimmen mit dem Ferienkalender überein, und es wird nichts verändert.

1. Als Admin **Organigramm** öffnen: Oben gibt es den Reiter **Kinder & Jugend**. Darin **Übersicht** mit dem
   Jahresband (Angekündigt · Wechseltag · Stichtag) und einer Kachel je Gruppe mit Zahl und Chips („… wechseln“,
   „… ohne Geburtstag“).
2. Den Wechseltag mit dem Kalender **Schulferien NRW** vergleichen: Er ist der erste Montag nach den Sommerferien.
3. Eine Kachel anklicken: Die Gruppe zeigt „Wechseln zu …“, „Bleiben in …“ und „Kommen neu dazu“. **Übersicht**
   (mit Pfeil) führt zurück.
4. Ein Kind anklicken: Ein Fenster mit Gruppe, Geburtstag, Alter am Stichtag und Wechsel; **In
   ChurchTools öffnen** führt zur Person. (Den Schalter „Bleibt noch ein Jahr“ prüft TF-ORG-18.)
5. **Daten pflegen**: „Geburtstag fehlt“ und „Wird bis zum Stichtag 18“ mit den passenden Kindern.
6. Als Leitung einer Kindergruppe: Der Reiter heißt dort **Meine Gruppe**, ohne Übersicht und ohne „Wird 18“. Vor
   der Ankündigung steht bei „Kommen neu dazu“ nur, ab wann man es sieht.
7. Der Leitung das Recht auf „Schulferien NRW“ wegnehmen und neu laden: ein Hinweis, dass der Kalender fehlt, statt
   leerer Listen. Danach das Recht wieder geben.
8. Als Person ohne Kindergruppe und ohne Admin-Recht: Es gibt keinen Reiter **Kinder & Jugend**.
9. In ChurchTools nachsehen: Gruppen und Mitglieder sind unverändert (solange man keinen Schalter bedient hat).

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `organigramm/src/KinderJugend.tsx`, `organigramm/src/ladeKinderJugend.ts`, `organigramm/src/gruppenwechselSpeicher.ts`, `organigramm/src/ladeMitglieder.ts`, `organigramm/src/App.tsx`, `shared/organigramm/gruppenwechselSicht.ts`, `shared/organigramm/gruppenwechselEinrichtung.ts`, `shared/organigramm/gruppenwechsel.ts`, `shared/ct/kalenderTermine.ts`
- **Automatisiert:** größtenteils – `App.test.tsx` (O9-2: Reiter nur mit Einrichtung und Zugang, Übersicht und
  Gruppe, Kind-Fenster, Daten pflegen, kein Kalender, Leitung), `ladeKinderJugend.test.ts` (Kalender nach Namen,
  403 → kein Kalender, vorübergehend → „Erneut versuchen“, 401), `gruppenwechselSicht.test.ts`,
  `gruppenwechselEinrichtung.test.ts`; die echten Rechte, den echten Ferienkalender und zwei Konten prüft nur dieser
  Fall
- **Historie:** Bauplan O9-2; Entwurf `kj-gruppenwechsel-v1.html` (v3), entschieden 11. und 12.11.2026 (O9-F5, O9-F6)

</details>

### TF-ORG-17 · Personen für alle ohne Leitung (Sichtbarkeitsstufe)

**Das brauchst du:** Die Test-Instanz mit der Erweiterung; ein Gruppen-Admin und zwei weitere Personen: eine, die eine
Untergruppe leitet (z. B. Ton unter Technik), und eine, die nichts leitet. Laptop.

**Das muss passieren:** Wer nichts leitet, sieht höchstens, was die Admins eingestellt haben – überall, wo Namen stehen.
Leitungen sehen ihre Gruppen voll, Admins alles. Nichts wird gespeichert, wenn etwas nicht lesbar ist.

1. Als Admin **Einstellungen**: Unter „Personen für alle ohne Leitung“ vier Stufen, darunter „Das ist nur eine
   Anzeige-Regel …“. **Nur Zahlen** wählen: Ein Hinweis zum Leserecht erscheint, unten steht „… · Personen: Nur
   Zahlen“. Speichern. Über dem Baum: „Für alle ausgeblendet: die Namen von Personen …“. Der Admin sieht weiter alle
   Namen.
2. Als Person ohne Leitung: **Karten** zeigen „Leitung: 1 Leiter“ statt Namen, keine Bilder. **Liste** mit Personen
   **Alle**: nur Zahlen je Rolle. Ein Gruppenfenster: Überschriften mit Zahl, keine Namen, darunter „Namen sind hier
   ausgeblendet …“.
3. **Präsentieren**: Kacheln mit „1 Leiter“ statt Namen, die Zahlen stimmen; in einem Bereich keine Namen in den
   Spalten, „N Personen ausgeblendet“; **Von oben** nur Zahlen. **PDF / Drucken**: ebenso.
4. Als Leitung von Ton: In Ton (und darunter) alle Namen, in Technik und Gottesdienst nur Zahlen; in der Spalte Technik
   der Präsentation stehen nur die Namen aus Ton.
5. Admin stellt **Wie „Rollen“**: Leitung und Organisatoren mit Namen, Mitarbeiter als Zahl. Dann **Keine Personen**:
   Kästchen ohne Personen, das Gruppenfenster zeigt nur „Die Personen sind hier ausgeblendet …“, Kacheln „1 Leiter“.
6. Netz kurz trennen (oder in den Entwicklerwerkzeugen die Anfrage blockieren) und neu laden: Hinweis „… ließ sich
   gerade nicht laden – zu sehen sind alle Gruppen, Personen vorsichtshalber ohne Namen“; **Erneut versuchen** bei
   Netz: Die eingestellte Stufe gilt wieder. In ChurchTools hat sich nichts geändert.
7. Zum Schluss als Admin wieder **Alle Namen** speichern.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/organigramm/personen.ts`, `shared/organigramm/sichtbereich.ts`, `shared/organigramm/sichtbarkeit.ts`,
  `shared/organigramm/praesentation.ts`, `organigramm/src/kastenPersonen.ts`, `organigramm/src/Organigramm.tsx`,
  `organigramm/src/GruppenFenster.tsx`, `organigramm/src/Praesentation.tsx`, `organigramm/src/PdfFenster.tsx`,
  `organigramm/src/EinstellungenFenster.tsx`, `organigramm/src/stufeTexte.ts`, `organigramm/src/App.tsx`
- **Automatisiert:** größtenteils – `personen.test.ts` (Stufen, Namen je Stufe, Teilbaum, Leitung gezählt),
  `sichtbereich.test.ts` (Grenze je Gruppe), `sichtbarkeit.test.ts` (alte Werte, Unbekanntes), `kastenPersonen.test.ts`,
  `praesentation.test.ts`, `App.test.tsx` (Karten, Liste, Gruppenfenster, Präsentation, PDF, Leitung, Admin, nicht
  lesbar, kein Leserecht, Einstellungen); mit echten Personen und Rechten prüft es nur dieser Fall
- **Historie:** #915 Scheibe C; Entscheidungen 12.11.2026 (vier Stufen, Leitung streng nach Stufe, nicht lesbar →
  keine Namen, kein Leserecht → Admins warnen)

</details>

### TF-ORG-18 · Kinder & Jugend: Ausnahme setzen („Bleibt noch ein Jahr“)

**Das brauchst du:** Die Test-Instanz mit der Erweiterung und der Einrichtung des Gruppenwechsels (wie TF-ORG-16),
dazu eine **Wechsel-Gruppe** zwischen zwei Stufen (z. B. Gruppe „TEST O9 Wechsel Kinder → Ziel“, Gruppentyp
„Gruppenwechsel“) und ein Kind in der unteren Stufe, das am Stichtag alt genug ist. Ein Admin-Konto und ein Konto, das
die Wechsel-Gruppe leitet (Leiter-Rolle mit „Status ändern“). **Vorsicht: Das schreibt in ChurchTools** – nur die
Test-Instanz, und die Testkinder danach wieder zurücksetzen.

**Das muss passieren:** Der Schalter erscheint nur, wo das Recht an der Wechsel-Gruppe da ist, speichert sofort,
„Rückgängig“ steht im Fenster, und nach dem Wechseltag gibt es keinen Schalter mehr. Bei einem Fehler geht nichts
verloren.

1. Als **Admin** vor der Ankündigung Reiter **Kinder & Jugend** → die Gruppe → das Kind: Der Schalter **„Bleibt noch ein
   Jahr in …“** ist aus, darunter steht, wann das Kind von selbst wechselt. Einschalten: „Ausnahme eingetragen ·
   Rückgängig“, der Schalter steht auf an, das Kind steht jetzt unter „Bleiben“ bzw. mit „bleibt noch ein Jahr“.
   In ChurchTools: Das Kind ist in der Wechsel-Gruppe mit Status **„zu löschen“** (Rolle Teilnehmer).
2. **Rückgängig**: Der Schalter ist wieder aus; in ChurchTools ist das Kind nicht mehr in der Wechsel-Gruppe.
3. Als **Leitung der Wechsel-Gruppe** vor der Ankündigung: Das Fenster zeigt statt des Schalters „Eine Ausnahme
   kannst du ab dem … eintragen.“ Nichts lässt sich verändern.
4. Ab der Ankündigung (Kind steht aktiv in der Wechsel-Gruppe) als Leitung: Schalter an → Status „zu löschen“ in
   ChurchTools, **Rückgängig** → wieder „aktiv“. Danach noch einmal an und wieder **aus** (Ausnahme aufheben):
   „Ausnahme aufgehoben · Rückgängig“.
5. Der Leitung in ChurchTools das Recht „Status ändern“ an der Wechsel-Gruppe wegnehmen, Reiter neu laden: statt des
   Schalters steht ein Hinweis, dass das Recht fehlt. Danach das Recht wieder geben.
6. Ein Kind, dessen Ausnahme schon **vor dem Wechseltag des Vorjahres** stand (in der Test-Instanz: Status von Hand
   gesetzt und ChurchTools-Datum vor diesem Tag – sonst nur im App-Test prüfbar): gelber Chip
   **„Ausnahme vom letzten Jahr“**, auf der Gruppenseite ein gelber Hinweis; im Fenster „Diese Ausnahme gilt seit
   letztem Jahr. Hebst du sie auf, wechselt … am …“
7. Nach dem Wechseltag (Phase „Der Wechsel läuft“): kein Schalter mehr, ein kurzer Hinweis.
8. Netz kurz trennen und den Schalter betätigen: „Gerade nicht gespeichert …“, der Schalter bleibt, wie er war, kein
   „Rückgängig“. Netz wieder an, erneut schalten: Es klappt.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `organigramm/src/KinderJugend.tsx`, `organigramm/src/ausnahmeTexte.ts`, `organigramm/src/ladeKinderJugend.ts`, `organigramm/src/mitgliedschaft.ts`, `shared/organigramm/mitgliedschaft.ts`, `shared/organigramm/gruppenwechselSicht.ts`, `shared/organigramm/rechte.ts`
- **Automatisiert:** größtenteils – `mitgliedschaft.test.ts` (shared: setzen bei Mitglied/Nicht-Mitglied, aufheben, Rückgängig, Nachlesen),
  `gruppenwechselSicht.test.ts` (Vorjahr an der Grenze, `ausnahmeStand`), `rechte.test.ts` (`statusAendern`),
  `ladeKinderJugend.test.ts` (Rechte je Wechsel-Gruppe), `App.test.tsx` (O9-3: Leitung, Admin vor der Ankündigung,
  nach dem Wechseltag, Fehler, Vorjahr); mit den echten Rechten und ChurchTools prüft es nur dieser Fall. Die
  ChurchTools-Aufrufe sind am 16.11.2026 gemessen (`organigramm-planung/docs/messung-o9-3-2026-11-16.md`)
- **Historie:** Bauplan O9-3; Entwurf `kj-gruppenwechsel-v1.html`, entschieden 16.11.2026

</details>

### TF-ORG-19 · Kinder & Jugend: Wechseltage ansehen und die Leitungen benachrichtigen

**Das brauchst du:** Die Test-Instanz mit der Erweiterung und der Einrichtung des Gruppenwechsels (wie TF-ORG-16) samt
Wechsel-Gruppen mit Regeln, ein Konto mit dem Recht **„Berechtigungen verwalten“**, ein Konto der Bereichsleitung **ohne**
dieses Recht (auch ein Gruppen-Admin ohne das Recht eignet sich) und ein Konto, das nur eine Kindergruppe leitet. Dieser
Fall liest nur – er verändert nichts in ChurchTools (die Regel in Schritt 6 nur in der Test-Instanz und danach zurück).

**Das muss passieren:** Nur Bereichsleitung und Admins sehen **Wechseltage**. Wer „Berechtigungen verwalten“ hat, sieht
zusätzlich, welche Jahre in den Regeln der Wechsel-Gruppen stehen, und eine Erinnerung, wenn sie auslaufen. Ab der
Ankündigung steht ein Text für die Leitungen bereit.

1. Als **Leitung einer Kindergruppe**: Im Reiter Kinder & Jugend gibt es nur **Meine Gruppe** und **Daten pflegen**,
   keinen Unterreiter **Wechseltage**.
2. Als **Bereichsleitung ohne das Recht** (oder Gruppen-Admin ohne das Recht): Neben **Übersicht** und **Daten pflegen**
   steht **Wechseltage**. Die Tabelle hat je Jahr Sommerferien, Ankündigung, Wechseltag (mit Wochentag, z. B. „Mo,
   06.09.2027“) und Stichtag – **keine Spalte „In den Regeln“, keine Erinnerung**, auch nicht in der Übersicht. Am Handy
   (375 px) lässt sich die Tabelle in der Karte seitlich schieben, die Seite selbst rutscht nicht.
3. Als **Konto mit „Berechtigungen verwalten“**: Zusätzlich die Spalte **In den Regeln**. Sind die Regeln aller
   Wechsel-Gruppen vom Erzeuger geschrieben, stehen die Jahre darin auf „eingetragen“, spätere auf „fehlt noch“. Eine
   Wechsel-Gruppe ganz ohne Regeln (ChurchTools meldet 404) zeigt „fehlt noch“ – keinen Fehler. Steht ein Jahr nur in
   einem Teil der Gruppen, heißt es „unvollständig – fehlt bei …“. Ein von Hand geschriebenes Fenster (z. B. an der
   Test-Gruppe 315) zählt nicht: „fehlt noch“.
4. Reichen die Regeln nur noch bis zum Jahr des nächsten Wechsels: gelb „Wechseltage fehlen bald. Die Regeln reichen nur
   noch bis …“ – auf der Seite und kurz („Mehr unter „Wechseltage““) in der **Übersicht**. Fehlt schon das nächste Jahr:
   gelb „Ab … fehlen Wechseltage in den Regeln. Die Sommerferien dafür stehen schon im Kalender …“. Reichen sie weiter:
   kein gelber Hinweis. Es steht nirgends „Einrichten“ oder „mit einem Klick“.
5. **Leitungen Bescheid geben:** Vor der Ankündigung steht nur „Ab der Ankündigung am … steht hier ein Text“. Ab der
   Ankündigung (Wechseltag in unter acht Wochen; sonst mit einem Testjahr kurz davor prüfen) steht ein Text mit dem
   Wechseltag und je Übergang „• Fische → Jungschar: N Kinder“. Die Zahlen sind dieselben wie die „wechseln“-Chips in
   der **Übersicht** (Ausnahmen zählen nicht mit). **Text kopieren** → „Kopiert“, danach in eine Nachricht einfügen:
   derselbe Text. Geht das Kopieren nicht (z. B. Zwischenablage gesperrt), ist der Text markiert, und es steht „Markiert
   – jetzt kopieren“.
6. In ChurchTools in der Kinder-Regel einer Wechsel-Gruppe das Fenster des nächsten Jahres entfernen (nur Test-Instanz,
   danach zurücksetzen), Reiter neu laden: Das Jahr steht auf „unvollständig – fehlt bei …“, die Erinnerung erscheint.
7. Netz kurz trennen und **Wechseltage** neu laden: Mit dem Recht steht „nicht prüfbar“ und ein ruhiger Hinweis, **keine**
   Erinnerung und kein Abmelden. Dasselbe, wenn einem Gruppen-Admin ohne das Recht die Regeln verwehrt sind – er wird
   nicht abgemeldet (er fragt sie ohnehin nicht ab).

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `organigramm/src/KinderJugend.tsx`, `organigramm/src/Wechseltage.tsx`, `organigramm/src/ladeRegelStand.ts`, `shared/organigramm/wechseltage.ts`, `shared/organigramm/rechte.ts`, `ui/bedienung/useKopieren.ts`
- **Automatisiert:** größtenteils – `wechseltage.test.ts` (läuft-aus-Regel, Jahr-Status gegen den Erzeuger
  `wechselGruppenRegeln`, lückenlose Kette, Text für die Leitungen), `rechte.test.ts` (`rechteVerwalten` getrennt von
  `gruppenVerwalten`), `ladeRegelStand.test.ts` (404 = keine Regeln, 401/403/Netz = nicht prüfbar, unvollständig,
  handgeschriebenes Fenster), `Wechseltage.test.tsx` und `KinderJugend.test.tsx` (Unterreiter, Spalte und Abfrage nur
  mit dem Recht, Hinweise, Kopieren samt Rückfall), `useKopieren.test.tsx`; mit den echten Regeln und der echten
  Zwischenablage prüft es nur dieser Fall
- **Historie:** Bauplan O9-4; Entwurf `kj-gruppenwechsel-v1.html`, entschieden 16.11.2026, O9-F8 (Regeln als einzige Quelle)

</details>

### TF-ORG-20 · Kinder & Jugend: Einrichtung ansehen (Stand in ChurchTools)

**Das brauchst du:** Die Test-Instanz mit der Erweiterung, ein Konto mit **„Berechtigungen verwalten“** (am besten
ohne Kindergruppe und ohne Gruppen-Admin), ein Gruppen-Admin **ohne** dieses Recht und – für Schritt 5 bis 7 – die
Möglichkeit, den gespeicherten Wert der Kategorie „Gruppenwechsel“ in der Test-Instanz vorübergehend zu ändern (danach
zurück). Dieser Fall liest nur; geschrieben wird nichts außer diesem einen Testwert.

**Das muss passieren:** Wer „Berechtigungen verwalten“ hat, sieht den Reiter Kinder & Jugend immer und erfährt dort, wie
es um die Einrichtung steht – und verwechselt „nicht eingerichtet“ nie mit „nicht lesbar“.

1. Als **Konto mit dem Recht** bei eingerichtetem Gruppenwechsel: Der Reiter hat **Übersicht, Daten pflegen, Wechseltage,
   Einrichtung**. Als Gruppen-Admin **ohne** das Recht fehlt **Einrichtung**.
2. **Einrichtung** öffnen: Karte „Stufen“ mit der Kette der Stufen („ab N Jahren“), „Wechsel-Gruppen unter …“, Ferienkalender,
   Stichtag („30.09.“) und Ankündigung („8 Wochen vor dem Wechseltag“). Darunter der Knopf „Stufen ändern …“
   (TF-ORG-21); „Rechte setzen …“ und „Nachtragen …“ stehen nur bei einem ⚠ in der Karte darunter (TF-ORG-22).
3. Karte „Stand in ChurchTools“: sechs Zeilen (Gruppentyp, Rechte der Leitung, Wechsel-Gruppen, Wechseltage, Regeln,
   Routinen). Nach „Einrichten“ in ChurchTools stehen alle auf „in Ordnung“, kein gelber Sammelhinweis.
4. In ChurchTools etwas verstellen (nur Test-Instanz, danach zurück): am Typ „Gruppenwechsel“ bei der Leiter-Rolle „Gruppeninfos
   sehen“ wegnehmen; eine Routine ausschalten; die Wartezeit einer Routine ändern; eine Regel in einer Kindergruppe von
   Hand dazuschreiben; eine Wechsel-Gruppe woanders hinhängen. Reiter neu laden: Die jeweilige Zeile zeigt „stimmt nicht“ mit
   dem Grund („fehlt: …“, „wartet 60 statt 90 Tage“, „fremde Regel …“, „hängt nicht unter …“, „rechnet nicht von selbst neu –
   der Status steht auf „manuell““), oben steht „Eine Sache braucht dich.“ bzw. „… Dinge brauchen dich.“.
5. Den Wert der Kategorie „Gruppenwechsel“ so verderben, dass ihn die Erweiterung nicht mehr liest (z. B. ein Feld
   löschen): Mit dem Recht steht „Die gespeicherte Einrichtung ließ sich nicht lesen. Es wird nichts überschrieben.“ – **nicht**
   „noch nicht eingerichtet“. Ohne das Recht gibt es den Reiter nicht.
6. Wert löschen (Kategorie bleibt leer): Mit dem Recht „Gruppenwechsel noch nicht eingerichtet“ mit der Erklärung und dem Satz
   dem Knopf **„Einrichten …“** (öffnet das Fenster, siehe TF-ORG-21). Ohne das Recht kein Reiter. Wert danach wiederherstellen.
7. Netz kurz trennen und die Seite neu laden: Beim Reiter mit dem Recht steht „Die Einrichtung ließ sich gerade nicht lesen.
   Es wird nichts verändert.“ mit „Erneut versuchen“ – **nicht** „noch nicht eingerichtet“. Auf der Seite „Einrichtung“
   zeigen nicht lesbare Zeilen „nicht prüfbar“, **keine** Warnung „fehlt“, und es erfolgt kein Abmelden.
8. Am Handy (375 px): Die Seite rutscht nicht seitlich; die Kette der Stufen bricht um.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `organigramm/src/EinrichtungSeite.tsx`, `organigramm/src/App.tsx`, `organigramm/src/KinderJugend.tsx`, `organigramm/src/ladeEinrichtungStand.ts`, `organigramm/src/gruppenwechselSpeicher.ts`, `organigramm/src/speicher.ts`, `shared/organigramm/einrichtungStand.ts`
- **Automatisiert:** größtenteils – `einrichtungStand.test.ts` (Soll aus den Erzeugern `alleRegeln`, `aufraeumRoutine`,
  `LEITER_RECHTE`; jeder Warn-Fall und „nicht prüfbar“ einzeln), `ladeEinrichtungStand.test.ts` (404 = keine Regeln,
  401/403/Netz/5xx = nicht gelesen, Drosselung), `gruppenwechselSpeicher.test.ts` (eingerichtet / keine / unlesbar /
  Fehler), `App.test.tsx` (Sichtbarkeit des Reiters je Fall mit und ohne Recht) und `KinderJugend.test.tsx` (Unterreiter,
  Sammelhinweis); mit den echten ChurchTools-Antworten prüft es nur dieser Fall
- **Historie:** Bauplan O9-5c (Entwurf `o9-5-einrichten-v1.html`); Messung 16.11.2026 (O9-5a): `remove-member` kommt mit `actionData: null` zurück

</details>

### TF-ORG-21 · Kinder & Jugend: Fenster „Einrichten“ / „Stufen ändern“ (Stufen und Vorschau)

**Das brauchst du:** Die Test-Instanz mit der Erweiterung und ein Konto mit **„Berechtigungen verwalten“**; für Schritt 7
eine Stufen-Gruppe mit einer von Hand geschriebenen Regel (nur Test-Instanz). Dieser Fall prüft Stufen und Vorschau und
**bricht vor dem Hauptknopf ab** – das Schreiben selbst steht in TF-ORG-22.

**Das muss passieren:** Das Fenster lässt sich ausfüllen und zeigt vorher, was passieren würde – es geht aber nie ein
Schritt weiter, wenn etwas fehlt oder fremde Regeln im Weg stehen, und bis zum Hauptknopf verändert es in ChurchTools
nichts.

1. Ohne Einrichtung (Wert der Kategorie „Gruppenwechsel“ vorübergehend löschen): **„Einrichten …“** öffnet ein Fenster
   „Gruppenwechsel einrichten“ mit der Schrittanzeige „Stufen › Vorschau › Fertig“. Mit Einrichtung öffnet
   **„Stufen ändern …“** (Seite Einrichtung) das Fenster „Stufen ändern“, vorbelegt mit den gespeicherten Stufen, der
   Bereichsgruppe und 8 Wochen Ankündigung.
2. **Weiter zur Vorschau** ohne Bereichsgruppe oder mit einer leeren Stufe: Es geht nicht weiter, die Hinweise stehen am
   Feld bzw. über der Liste („Es ist noch keine Gruppe gewählt …“). Dieselbe Gruppe zweimal, ein Alter, das nicht steigt, und
   eine Bereichsgruppe, die zugleich Stufe ist: je ein eigener Hinweis.
3. Stufen nach oben/unten schieben, entfernen (bei zwei Stufen aus) und eine hinzufügen: Die Reihenfolge gilt auch für die
   Prüfung. „Weitere Einstellungen“ aufklappen: Stichtag „30.09.“, Ankündigung in **Wochen**, die Ferien aus der Liste
   der sichtbaren Kalender mit „Sommerferien gefunden bis …“. Ein falscher Wert klappt die Einstellungen von selbst auf.
4. **Vorschau → „Wer wechselt wann wohin“:** Tabelle Jahr × Übergang mit Zahlen; „Namen für <Jahr> zeigen“ nennt die Kinder
   des ersten Jahres. Stichprobe: Die Zahl eines Übergangs stimmt mit „Übersicht“ (Bereichsleitung) überein. Kinder ohne
   Geburtstag: gelber Hinweis „N Kinder ohne Geburtstag wechseln nie von selbst“.
5. **„Das legt die Erweiterung in ChurchTools an“:** je Baustein „neu“, „vorhanden“ oder „ändern“ (Gruppentyp,
   Rechte der Rolle „Leiter“ als drei Namen, Wechsel-Gruppen, Routinen, Regeln). Bei vollständig eingerichteten Stufen
   steht fast alles auf „vorhanden“, die Regeln auf „ändern“. Der Hinweis „Es wird keine Mail verschickt“ nennt die
   Ankündigung des ersten Jahres.
6. **Fußzeile:** „Abbrechen“ und der Hauptknopf („Jetzt einrichten“ bzw. „Änderungen schreiben“) – er ist an, sobald alles
   gelesen und gut ist (beim Einrichten erst mit dem Haken „Ich habe die Rechte der Leitung geprüft …“, beim Ändern gibt es
   keinen Haken). Zurück zu den Stufen geht es mit „‹“ vor dem Titel. Nach „Abbrechen“ ist in ChurchTools und im Speicher
   nichts anders. **Beim Ändern** ist die Bereichsgruppe nur eine Anzeige mit dem Satz „Lässt sich hier nicht ändern. …“ (gesperrt).
7. **Fremde Regeln:** In einer gewählten Stufen-Gruppe steht eine von Hand geschriebene Regel: roter Hinweis mit Gruppe,
   Zahl und Beispiel, der Haken ist nicht anklickbar. Gruppe aus den Stufen nehmen (Zurück): Der Hinweis ist weg. Netz
   kurz trennen und die Vorschau neu öffnen: „Die Regeln von … ließen sich nicht prüfen“ mit „Nochmal prüfen“ – nie so, als
   gäbe es keine.
8. Am Handy (375 px): Die Stufenzeilen brechen um, das Fenster rutscht nicht seitlich, die Gruppensuche ist bedienbar, die
   Tabelle scrollt waagerecht.
9. **Läuft heute ein Wechsel** (nur prüfbar, wenn heute zwischen Ankündigung und Ende der Aufnahme eines Jahres liegt, sonst
   an einer Test-Instanz mit passendem Ferientermin): In der Vorschau steht ganz oben gelb „Der Wechsel … läuft gerade – nach dem
   Schreiben kommen N Kinder sofort in die Wechsel-Gruppe bzw. werden verschoben.“ und der Hauptknopf bleibt trotzdem an.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `organigramm/src/EinrichtenFenster.tsx`, `organigramm/src/EinrichtenStufen.tsx`, `organigramm/src/EinrichtenVorschau.tsx`, `organigramm/src/EinrichtungSeite.tsx`, `organigramm/src/ladeEinrichten.ts`, `organigramm/src/SpitzenAuswahl.tsx`, `shared/organigramm/einrichtungPlan.ts`, `shared/organigramm/einrichtungFormular.ts`, `shared/organigramm/einrichtungVorschau.ts`, `shared/organigramm/gruppenwechsel.ts`, `shared/organigramm/gruppenwechselEinrichtung.ts`
- **Automatisiert:** größtenteils – `einrichtungPlan.test.ts` (Plan gegen die Erzeuger, Reihenfolge, „nicht lesbar“ nie „fehlt“,
  fremde Regeln, `darfSchreiben`), `einrichtungFormular.test.ts` (Wochen ↔ Tage, Stichtag, gleiche Prüfung wie beim Lesen),
  `einrichtungVorschau.test.ts`, `ladeEinrichten.test.ts` (nicht lesbar ≠ „nicht da“, Drosselung), `EinrichtenFenster.test.tsx`
  (beide Wege hinein, Stufen bearbeiten, Vorschau, Stopp, Haken, Bereich beim Ändern gesperrt), `SchreibenFenster.test.tsx`
  (Warnung „Wechsel läuft gerade“) und `gruppenwechsel(Einrichtung).test.ts` (Prüfung); mit den
  echten ChurchTools-Antworten, der echten Gruppensuche und am Handy prüft es nur dieser Fall
- **Historie:** Bauplan O9-5c-2 (Entwurf `o9-5-einrichten-v1.html`, Schritte „Stufen“ und „Vorschau“); Messung O9-5a 16.11.2026 (Reihenfolge, keine Mail)

</details>

### TF-ORG-22 · Kinder & Jugend: Gruppenwechsel schreiben, Wechseltage nachtragen, Rechte setzen

**Das brauchst du:** Die Test-Instanz (**nie die Live-Instanz**) mit der Erweiterung, ein Konto mit **„Berechtigungen
verwalten“**, die Test-Gruppen aus O9-0 (Bereich, Kindergruppen) und einen Ferienkalender mit Sommerferien. Vorher alles
sichern (Wert der Kategorie „Gruppenwechsel“, Regeln und Status der Test-Gruppen, Rechte am Typ). Dieser Fall **schreibt in
ChurchTools** – nur mit Testdaten, danach zurückbauen und nachlesen. Es wird keine Mail verschickt.

**Das muss passieren:** Der Hauptknopf legt genau an, was die Vorschau gezeigt hat – in fester Reihenfolge, jeder Schritt
nachgelesen –, hört beim ersten Fehler auf, und „Nochmal versuchen“ schreibt nur, was fehlt, ohne je eine zweite Wechsel-Gruppe
für denselben Übergang anzulegen.

1. **Einrichten** (Wert der Kategorie vorübergehend entfernt, Gruppentyp und Wechsel-Gruppen der Test-Instanz zuvor
   weggeräumt): Fenster ausfüllen, Vorschau, Haken „Rechte der Leitung geprüft“, **Jetzt einrichten**. Während es läuft, ist das
   Fenster nicht zu schließen. Danach „Fertig. Alles ist in ChurchTools nachgelesen.“ mit einer Zeile je Baustein (Typ, Rechte,
   Wechsel-Gruppen, Routinen, Regeln, Kindergruppen, Neu berechnet, Einrichtung gespeichert) und dem Kasten „Damit die Leitungen
   den Reiter sehen“. **Fertig** schließt; die Seite „Einrichtung“ steht danach auf lauter ✓, **Status „aktiv“** an allen
   Wechsel-Gruppen und Kindergruppen (in ChurchTools nachsehen), die Wechsel-Gruppen sind **eingeschränkt** (nicht „versteckt“: Eine
   Kindergruppen-Leitung muss sie sehen und ihre Mitglieder lesen können) und hängen unter der Bereichsgruppe.
2. **Stufen ändern → Änderungen schreiben** (z. B. eine Stufe entfernen): Die Bereichsgruppe ist gesperrt. Nach dem Schreiben
   fehlen in der entfernten Stufe unsere Regeln (fremde Regeln dort, falls vorhanden, bleiben; ohne Regeln steht der Status auf
   „keiner“), die nicht mehr gebrauchte Wechsel-Gruppe steht noch in ChurchTools und wird in „Fertig“ genannt – **nichts wurde
   gelöscht**.
3. **Fehlerfall:** Netz während des Schreibens kurz trennen (oder ein Recht entziehen): „Nicht ganz fertig.“ mit ✗ und dem
   Grund („ChurchTools hat nicht geantwortet …“ bzw. „Dir fehlt in ChurchTools das Recht …“), der Rest „noch nicht geschrieben“,
   unten **Später** und **Nochmal versuchen**. Netz zurück, **Nochmal versuchen**: Es entstehen keine zweite Wechsel-Gruppe und
   kein zweiter Typ; in „Fertig“ stehen nur die Schritte, die vorher fehlten.
4. **Die Lücke** (nur mit Absicht herbeiführen, z. B. Netz genau nach dem Anlegen einer Wechsel-Gruppe trennen): Die Seite
   „Einrichtung“ zeigt bei „Wechsel-Gruppen“ ⚠ „Gruppe N steht unter … nicht in der Einrichtung eingetragen“; „Stufen ändern →
   Änderungen schreiben“ übernimmt die Gruppe statt eine neue anzulegen.
5. **Rechte setzen:** Am Typ „Gruppenwechsel“ bei der Leiter-Rolle „Gruppeninfos sehen“ von Hand entziehen. Seite „Einrichtung“:
   ⚠ bei „Rechte der Leitung“ mit dem Knopf **Rechte setzen …**. Fenster: drei Rechte, das fehlende als „ergänzen“, der Knopf
   „Recht setzen“ erst mit dem Haken. Danach „Fertig“, in ChurchTools steht das Recht wieder da, ein von Hand gesetztes
   Zusatzrecht an der Rolle ist **noch da**. Bei einem Recht, das nur zusätzlich steht, gibt es keinen Knopf.
6. **Wechseltage nachtragen:** Eine Test-Gruppe so verändern, dass die Regeln nur bis zum nächsten Jahr reichen (oder
   Ferientermine für weitere Jahre eintragen). Seite „Wechseltage“: gelber Hinweis mit **Wechseltage nachtragen …**; ebenso
   **Nachtragen …** in der Zeile der Seite „Einrichtung“. Fenster: nur die neuen Jahre in der Tabelle, „Regeln in N Gruppen um
   … ergänzen“. Nach „Fertig“ steht die Spalte „In den Regeln“ auf „eingetragen“; eine zuvor gesetzte Ausnahme („zu löschen“) in
   einer Wechsel-Gruppe ist unverändert.
7. Hat eine Stufen-Gruppe eine fremde Regel: Einrichten, Ändern und Nachtragen halten mit dem roten Hinweis an, nichts wird
   geschrieben. Ändert jemand zwischen Vorschau und Schreiben die Einrichtung (zweiter Tab), meldet der Lauf, dass nichts
   überschrieben wurde.
8. Am Handy (375 px): „Fertig“ (Liste, Knöpfe untereinander) und die beiden kurzen Fenster rutschen nicht seitlich.
9. **Rückbau:** Test-Wechsel-Gruppen, Routinen, Regeln, Status, Typ und den Wert der Kategorie zurücksetzen und mit dem Stand
   vor dem Test vergleichen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `organigramm/src/einrichtenSchreiben.ts`, `organigramm/src/ladeSchreibLage.ts`, `organigramm/src/useSchreibLauf.ts`, `organigramm/src/fertigListe.ts`, `organigramm/src/EinrichtenFertig.tsx`, `organigramm/src/NachtragenFenster.tsx`, `organigramm/src/RechteFenster.tsx`, `organigramm/src/EinrichtenFenster.tsx`, `organigramm/src/EinrichtungSeite.tsx`, `organigramm/src/Wechseltage.tsx`, `organigramm/src/gruppenwechselSpeicher.ts`, `shared/organigramm/einrichtungPlan.ts`, `shared/organigramm/einrichtungStand.ts`, `shared/organigramm/einrichtungVorschau.ts`
- **Automatisiert:** größtenteils, gegen ein gefälschtes ChurchTools – `einrichtenSchreiben.test.ts` (Reihenfolge = Plan, Nachlesen je Schritt
  („200 ohne Wirkung“ ist ein Fehler), Abbruch beim ersten Fehler, vorübergehend/abgelehnt/anderer, Speichern nach jeder neuen
  Wechsel-Gruppe, „Nochmal versuchen“ ohne zweite Gruppe (beide Lücken), Versionskonflikt, Status „aktiv“, entfernte Stufe,
  Rechte nur ergänzen, Nachtragen nur Regeln), `fertigListe.test.ts`, `SchreibenFenster.test.tsx` (Fertig, Fehlerfall, Nachtragen-
  und Rechte-Fenster, Warnung, Knöpfe auf der Seite), `einrichtungPlan/-Stand/-Vorschau.test.ts`; mit den echten
  ChurchTools-Antworten prüft es nur dieser Fall (O9-F13)
- **Historie:** Bauplan O9-5d; Messungen O9-5a (16.11.2026) und O9-0; Entscheidungen O9-F11 (Bereich gesperrt), O9-F12 (Leserechte
  nur als Text), O9-F13 (Testlauf); Status „aktiv“ statt „manual“ (OpenAPI der Test-Instanz, 17.11.2026)

</details>

### TF-ORG-23 · Kinder & Jugend: mehrere Stufen leiten – die Gruppe über die Überschrift wählen

**Das brauchst du:** In der Test-Instanz ein Konto, das **zwei Kindergruppen** (Stufen) leitet, dazu ein Rechner und ein Handy
(oder 390 px Breite). Außerdem ein Konto, das nur **eine** Stufe leitet.

**Das muss passieren:** Im Unterreiter **Meine Gruppe** ist die Überschrift mit dem Namen der Stufe der Auswahlknopf („Fische ▾“).
Es gibt keine Leiste mit einem Knopf je Stufe und den Namen nicht doppelt.

1. Reiter **Kinder & Jugend** → **Meine Gruppe**: Über dem Jahresband steht der Stufenname mit einem kleinen Pfeil nach unten;
   darüber oder daneben keine zweite Leiste mit den Stufen.
2. Auf den Namen tippen: Die Liste zeigt beide Stufen, die aktuelle mit **Häkchen**. Die andere wählen: Die Liste schließt, die
   Überschrift und die Kinder wechseln zur anderen Stufe.
3. **Esc** oder ein Tipp daneben schließt die Liste, ohne etwas zu ändern. Am Handy liegt sie ganz im Bild.
4. Mit dem Konto, das nur eine Stufe leitet: Der Name ist eine einfache Überschrift ohne Pfeil.
5. Als Bereichsleitung: Die **Übersicht** zeigt Kacheln, die Gruppe öffnet sich mit **Übersicht**-Pfeil zurück – hier steht
   **kein** Auswahlknopf (die Kacheln sind die Wahl).

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `ui/bedienung/TitelWahl.tsx`, `organigramm/src/KinderJugend.tsx`
- **Automatisiert:** größtenteils – `ui/bedienung/TitelWahl.test.tsx`, `organigramm/src/KinderJugend.test.tsx` (zwei Stufen: Überschrift als Knopf, Wechsel, Name nicht doppelt; eine Stufe: keine Schaltfläche); Aussehen am Handy nur am Gerät
- **Historie:** 18.11.2026 (Anlass: dieselbe Gruppen-Leiste wie in Protokolle lief am Handy über; Alwin wollte dort dasselbe)

</details>

### TF-ORG-24 · Werkzeugzeile des Reiters Organigramm („Ruhige Bedienung“ B5)

**Das brauchst du:** Die Test-Instanz mit der Erweiterung; ein Konto mit eigenem Bereich (sieht auch den Reiter
**Personen**); Rechner (1280 px) und Handy (390 px).

**Das muss passieren:** Über dem Bild steht **eine** Zeile statt vier. Keine Funktion von früher fehlt – was selten ist,
liegt einen Klick tiefer.

1. Reiter **Organigramm**: Links der Auswahlknopf **Von oben ⌄**, in der Mitte **Bereich: Ganze Gemeinde**, rechts **Filter**,
   **Präsentieren** und **⋯**. Es gibt keinen Umschalter-Kasten mehr und kein „Anfangen bei“. Rechts neben „Hallo …“ steht
   kein Knopf mehr: **Einstellungen** ist (für Gruppen-Admins) der letzte Reiter ganz rechts (TF-EXT-13).
2. Auf **Von oben ⌄** klicken: Karten, Liste, Von oben, Von links, Mindmap; die gewählte ist fett. Jede Ansicht einmal wählen:
   Das Bild wechselt, nach dem Neuladen bleibt die Wahl.
3. **⋯**: in Liste und Diagrammen **Alle aufklappen**, **Alle zuklappen**, **PDF / Drucken** – jeden einmal klicken: Die Gruppen
   klappen auf bzw. zu, das PDF-Fenster öffnet sich mit Ansicht und Bereich der Zeile. In **Karten** steht nur **PDF / Drucken**.
4. **Filter** (nicht in Karten): **Personen** mit **Aus · Nur Rollen · Alle**; bei „Nur Rollen“ oder „Alle“ erscheint **Welche
   Rollen** mit einem Häkchen je Rolle, darunter **Alle** und **Nur Leitung**. Eine Rolle abwählen: Die Zahl am Filter wird 1.
5. **Bereich** anklicken, eine Gruppe wählen (auch über die Suche): Alle Ansichten zeigen nur sie; die Zeile zeigt „Bereich: …“.
6. **Präsentieren**: Die Präsentation öffnet sich; **Schließen** bringt zur Zeile zurück.
7. Reiter **Personen**: Neben den Reitern steht eine **Lupe**; ein Klick klappt das Suchfeld auf, ein Name filtert die Tabelle,
   ✕ leert und schließt. Über der Tabelle gibt es kein festes Suchfeld mehr. In den Reitern Organigramm und Hinweise gibt es
   die Lupe nicht.
8. Am Handy: Oben Ansicht (blau, mit Pfeil – öffnet ein Blatt von unten), Filter, Präsentieren (nur Symbol) und ⋯ – alle mit
   Rahmen; darunter **Bereich** über die ganze Breite. ⋯ öffnet ein Blatt mit denselben Einträgen.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `organigramm/src/Organigramm.tsx`, `organigramm/src/App.tsx`, `organigramm/src/Personen.tsx`, `organigramm/src/SpitzenAuswahl.tsx`, `ui/bedienung/AnsichtWahl.tsx`, `ui/bedienung/FilterKnopf.tsx`, `ui/bedienung/OptionWaehlen.tsx`
- **Automatisiert:** größtenteils – `App.test.tsx` (B5: Werkzeugzeile, Ansichtsmenü, jeder ⋯-Punkt einzeln, Handy, Filter, Lupe), `AnsichtWahl.test.tsx`, `FilterKnopf.test.tsx` (eine Wahl, Abkürzungen), `SpitzenAuswahl.test.tsx` (Vorsatz); Aussehen am Handy nur am Gerät
- **Historie:** 20.11.2026, Entwurf `organigramm-protokolle-ruhiger-v2` (E13/E15)

</details>
