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
