### Intern (Anmeldungen + Organigramm)

- **Anmeldungen: Grundlage für Nachweise** (Etappe F, Scheibe N1a; noch ohne Oberfläche, die kommt in N1b).
  `anmeldungen/src/nachweise.ts` liest (`nachweisGrundlageLesen`) und sichert (`nachweisGrundlageSichern`), was
  ChurchTools für Nachweis-Arten braucht: die Gruppenart „Nachweis“ und an ihrer Leiter-Rolle das gruppeninterne Recht
  „Follow-ups durchführen“. Angelegt wird nur, was fehlt; das Recht wird nur ergänzt, nie entzogen; alles wird nachgelesen.
  Die Rechte der Rolle liest die Erweiterung nur mit „Berechtigungen verwalten“; „nicht lesbar“ wird nie zu „fehlt“.
- **Ein gemeinsamer Baustein statt zwei Abschriften:** Suchen, Anlegen, Rollen und Rechte der Gruppenart stehen jetzt in
  `shared/ct/gruppenart.ts`, der echte ChurchTools-Anschluss in `ui/ct/ctPort.ts`. Das Organigramm („Gruppenwechsel
  einrichten“) nutzt ihn – Verhalten und Texte unverändert; `fehlendeLeiterRechte` ist ein Einzeiler darauf.
