# Organigramm – ChurchTools-Erweiterung

> **Stand: O1 (22.10.2026)** – Grundgerüst: zeigt die Bereiche (oberste Gruppen) mit der Zahl ihrer Gruppen,
> jede in der Farbe der Gruppe. Als Nächstes (Bauplan O2–O8): der ganze Baum mit Leitung und Mitgliedern,
> Personen-Sicht und Hinweise (nur Leitung/Admin), Präsentation, Gruppen umhängen und anlegen, Leitung und
> Mitglieder pflegen, Plan „neue Gliederung“ mit Umbau-Liste. Diese Anleitung wächst mit.

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

| Wer                             | Sieht / darf                                                                    | Woher (ChurchTools)                           |
| ------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------- |
| alle mit Zugang zur Erweiterung | die Gruppen, die ChurchTools ihnen zeigt, und den Baum                          | Erweiterung „Organigramm“ sehen               |
| Mitglied einer Gruppe           | deren Mitglieder **und die aller Untergruppen** – nicht die der Obergruppe      | Mitgliedschaft (Rechte wirken nur nach unten) |
| Leitung einer Gruppe            | Personen aufnehmen (ab O6) – **nicht** austragen, umhängen oder Gruppen anlegen | Rolle mit Leitung                             |
| Gruppen-Admin                   | umhängen, anlegen, alles an Mitgliedern (ab O5/O6)                              | „Gruppen verwalten“ / „Gruppen bearbeiten“    |

## Was die Erweiterung speichert

In O1 nichts. Ab O7 den Plan „neue Gliederung“ im Speicher der Erweiterung; alles andere liegt in ChurchTools.
