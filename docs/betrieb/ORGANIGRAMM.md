# Organigramm – ChurchTools-Erweiterung

> **Stand: O3 (22.10.2026)** – der ganze Baum (Bereiche als Karten, Gruppen mit Personen, Leitung, Diensten und
> offenen Plätzen; Gruppenfenster; Gruppentypen ausblendbar). Für die **Leitung eines Bereichs** dazu die Reiter
> **Personen** (wer ist wo, wer dient wie oft, Personenfenster) und **Hinweise** (Teams ohne Leitung, fast jede Woche,
> Dienst-Team ohne Einsatz, offene Anfragen). Als Nächstes (Bauplan O4–O8): Präsentation, Gruppen umhängen und
> anlegen, Leitung und Mitglieder pflegen, Plan „neue Gliederung“ mit Umbau-Liste. Diese Anleitung wächst mit.

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

| Wer                             | Sieht / darf                                                                        | Woher (ChurchTools)                           |
| ------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------- |
| alle mit Zugang zur Erweiterung | die Gruppen, die ChurchTools ihnen zeigt, und den Baum                              | Erweiterung „Organigramm“ sehen               |
| Mitglied einer Gruppe           | deren Mitglieder **und die aller Untergruppen** – nicht die der Obergruppe          | Mitgliedschaft (Rechte wirken nur nach unten) |
| Leitung einer Gruppe            | Personen aufnehmen (ab O6) – **nicht** austragen, umhängen oder Gruppen anlegen     | Rolle mit Leitung                             |
| Leitung einer Gruppe            | Reiter Personen und Hinweise für diese Gruppe **samt Untergruppen** (O3)            | Rolle mit Leitung                             |
| Gruppen-Admin                   | alle Personen und Hinweise (O3); umhängen, anlegen, alles an Mitgliedern (ab O5/O6) | „Gruppen verwalten“ / „Gruppen bearbeiten“    |

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

## Was die Erweiterung speichert

Bis O3 nichts (gemerkt wird nur pro Gerät, welche Gruppentypen ausgeblendet sind). Ab O7 den Plan „neue Gliederung“ im Speicher der Erweiterung; alles andere liegt in ChurchTools.
