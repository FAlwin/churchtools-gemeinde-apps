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
