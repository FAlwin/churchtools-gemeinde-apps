### Neu (Organigramm, O7b-7, #736)

- **Was das Organigramm für alle zeigt:** Gruppen-Admins blenden unter **„Einstellungen“** Gruppentypen und einzelne
  Gruppen für alle aus – im Reiter, in der Präsentation und in der PDF; eine ausgeblendete Gruppe nimmt ihre
  Untergruppen mit (Entwurf `o7b-6-7-v1.html`, entschieden 29.10.2026). Über dem Baum steht dann „Für alle
  ausgeblendet: …“; die Typ-Schildchen je Gerät bleiben zusätzlich. Gespeichert im Speicher der Erweiterung (Kategorie
  „Was das Organigramm zeigt“, Kürzel `sichtbar`) mit Version und Konfliktschutz; Lesen müssen es alle dürfen, ändern
  nur Gruppen-Admins (Rechte der Kategorie). In ChurchTools ändert sich nichts.

### Intern (Organigramm)

- Anschluss, Modulsuche und das Lesen eines Dokuments aus einer Kategorie stehen jetzt an einer Stelle
  (`organigramm/src/speicher.ts`) für Plan und Einstellung; die Fehlertexte beim Speichern ebenso (`planFehlerText`).
- `baumOhneTypen` blendet auch einzelne Gruppen aus – EIN Filter für Schildchen und Einstellung.
