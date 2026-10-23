# Organigramm – ChurchTools-Erweiterung

> **Stand: O5 (23.10.2026)** – der ganze Baum (Bereiche als Karten, Gruppen mit Personen, Leitung, Diensten und
> offenen Plätzen; Gruppenfenster; Gruppentypen ausblendbar), die **Präsentation** und für Gruppen-Admins **Gruppen
> umhängen und anlegen**. Für die **Leitung eines Bereichs** dazu die Reiter **Personen** und **Hinweise**. Als
> Nächstes (Bauplan O6–O8): Leitung und Mitglieder pflegen, Plan „neue Gliederung“ mit Umbau-Liste. Diese Anleitung
> wächst mit.

Das Organigramm zeigt die Gemeinde als Baum – Bereiche, Gruppen, Personen – so, wie die Gruppen-Hierarchie in
ChurchTools steht, und hilft, die Organisation darin weiterzubauen. **Alles liegt in ChurchTools** – es gibt keinen
eigenen Server.

## Installieren

1. Bei den [Releases](https://github.com/FAlwin/churchtools-gemeinde-apps/releases) die neueste Datei
   **`organigramm-v….zip`** herunterladen (nicht entpacken). Die Organigramm-Releases heißen „Organigramm v…“.
2. In ChurchTools: **Administration → Erweiterungen → Erweiterung hinzufügen**.
3. Ausfüllen:
   - **Name:** z. B. „Organigramm“ – so heißt der Menüpunkt.
   - **Kürzel:** genau **`organigramm`**. Die Erweiterung ist für diese Adresse gebaut (`/ccm/organigramm/`);
     mit einem anderen Kürzel lädt sie nicht.
   - **Im Menü anzeigen:** an.
   - **ZIP-Datei:** die heruntergeladene Datei.
4. **Speichern.**

**Aktualisieren:** beim Eintrag auf den Stift und die neue ZIP hochladen, sonst nichts ändern.

> ⚠️ Es gibt eine andere Organigramm-Erweiterung mit dem Kürzel `organigram` (ohne zweites „m“, von Dritten).
> Beide können nebeneinander installiert sein, heißen dann aber im Menü gleich – im Namen unterscheiden.

## Rechte

Die Erweiterung kann nichts, was die Person in ChurchTools nicht auch selbst dürfte – sie arbeitet mit deren
Sitzung. **Ein eigenes Rechte-System gibt es nicht.** Gemessen an der Test-Instanz (19. und 22.10.2026):

| Wer                             | Sieht / darf                                                                             | Woher (ChurchTools)                           |
| ------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------- |
| alle mit Zugang zur Erweiterung | die Gruppen, die ChurchTools ihnen zeigt, und den Baum                                   | Erweiterung „Organigramm“ sehen               |
| Mitglied einer Gruppe           | deren Mitglieder **und die aller Untergruppen** – nicht die der Obergruppe               | Mitgliedschaft (Rechte wirken nur nach unten) |
| Leitung einer Gruppe            | Personen aufnehmen (ab O6) – **nicht** austragen, umhängen oder Gruppen anlegen          | Rolle mit Leitung                             |
| Leitung einer Gruppe            | Reiter Personen und Hinweise für diese Gruppe **samt Untergruppen** (O3)                 | Rolle mit Leitung                             |
| Gruppen-Admin                   | alle Personen und Hinweise (O3); umhängen und anlegen (O5); alles an Mitgliedern (ab O6) | „Gruppen verwalten“ / „Gruppen bearbeiten“    |

## Präsentation (ab O4)

Über dem Baum steht **„Präsentieren“** – für alle, die die Erweiterung sehen. Die Präsentation legt sich über
ChurchTools:

- **Übersicht:** die Bereiche als Kacheln mit Leitung, Gruppen und Zahl der Personen. Klick auf eine Kachel öffnet
  den Bereich.
- **Bereich:** jede Gruppe als Spalte mit allen Personen darunter (jede einmal, Leitung zuerst); die Untergruppen
  lassen sich aufklappen.
- **Weiter/Zurück** unten, oder mit der Tastatur: Pfeile, Bild auf/ab, Leertaste · **Pos1** = Übersicht · **Esc** =
  zurück zur Übersicht, dort schließen · **F** = Vollbild (am Laptop; am iPad gibt es den Knopf nicht).
- Es gilt dieselbe Auswahl der Gruppentypen wie im Baum (z. B. Verteiler ausgeblendet).
- Wer nicht alle Mitglieder sehen darf, sieht dort „Mitglieder nicht sichtbar“ – „gesucht“ steht nur, wo wirklich
  niemand eingetragen ist.
- Gezeigt wird der Stand **heute** in ChurchTools. Die „neue Gliederung“ kommt mit dem Plan (O7).

## Personen und Hinweise (ab O3)

Nur für die **Leitung eines Bereichs**: Wer eine Gruppe leitet, sieht deren Personen und Hinweise samt allen
Untergruppen; Gruppen-Admins sehen alles; wer nichts leitet, sieht nur den Baum.

- **Einsätze** kommen aus den Terminen der letzten 6 und der nächsten 3 Monate – **soweit ChurchTools sie der Person
  zeigt**. Gezählt wird jede Einteilung (zugesagt oder angefragt). Nicht gezählt: abgesagte Termine, „Namen
  verbergen“, Gäste ohne Person.
- **Offene Plätze** („x offen“ im Baum) sind freie Plätze in kommenden Terminen; gehört ein Dienst zu mehreren
  Gruppen, steht die Zahl nur an der ersten.
- **Hinweise:** Teams ohne Leitung · Personen, die fast jede Woche dienen (ab 24 Einsätzen in 6 Monaten) · Personen in
  einem Dienst-Team ohne Einsatz · offene Mitgliedsanfragen (annehmen oder ablehnen in ChurchTools).
- Lassen sich die Termine gerade nicht laden, steht das da („Erneut versuchen“); die Hinweise, die Einsätze brauchen,
  entfallen dann.

## Gruppen umhängen und anlegen (ab O5)

Nur wer es in ChurchTools darf: Gruppen-Admins („Gruppen verwalten“) oder wer die Gruppe bzw. ihren Gruppentyp
bearbeiten darf; anlegen nur in den Typen, für die man das Recht „Gruppen anlegen“ hat. **Leitungen dürfen das in
ChurchTools nicht** – bei ihnen fehlen die Knöpfe.

Im **Gruppenfenster** (Klick auf eine Gruppe) unter „Gehört zu“:

- **Ändern** – die Gruppe bekommt eine andere Obergruppe. Gewählt wird aus einer Liste mit Suche; die Gruppe selbst,
  ihre Untergruppen und ihre jetzigen Obergruppen stehen nicht darin.
- **Lösen** – die Gruppe hängt nicht mehr unter dieser Obergruppe. War es die letzte, ist sie danach ein eigener Bereich.
- **＋ Weitere Obergruppe** – ChurchTools erlaubt mehrere Obergruppen; die Gruppe steht dann unter beiden.
- **＋ Untergruppe anlegen** – Name und Gruppentyp (vorbelegt mit dem Typ der Obergruppe), Status „aktiv“. Leitung und
  Mitglieder kommen danach in ChurchTools dazu.

Vor jeder Änderung steht, was sich an den **Rechten** ändert: Rechte wirken in ChurchTools nach unten – wer in der neuen
Obergruppe ist, sieht danach auch diese Gruppe samt Untergruppen; wer sie nur über die alte sah, sieht sie nicht mehr.
Danach zeigt das Fenster **„Rückgängig“** (auch eine neue Gruppe lässt sich so wieder löschen).

## Was die Erweiterung speichert

Bis O3 nichts (gemerkt wird nur pro Gerät, welche Gruppentypen ausgeblendet sind). Ab O7 den Plan „neue Gliederung“ im Speicher der Erweiterung; alles andere liegt in ChurchTools.
