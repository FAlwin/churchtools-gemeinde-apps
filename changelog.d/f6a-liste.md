### Neu (Anmeldungen)

- **Liste mit Zeilen – erste Scheibe (F6a).** Neuer Baustein unter „Eigene Fragen“ für Listen wie „Was bringst du privat mit?“: 1–5 Spalten (Text, Zahl, Auswahl), Einheit und „Summe zeigen“ für eine Zahl-Spalte, Höchstzahl Zeilen (1–50, vorbelegt 10). Bearbeitet wird direkt im Formular, darunter steht die Vorschau. Im Formular am Computer eine Zeilen-Tabelle, am Handy eine Karte je Eintrag; angefangene Zeilen halten das Absenden auf, leere fallen weg, die Summe zählt nur vollständige Zeilen. Abschicken und Freigabe für alle kamen mit F6b (siehe dort).

### Behoben (Anmeldungen)

- Wird eine eigene Frage mit freier Antwort („Sonstiges“ mit Textfeld) gelöscht, verschwindet jetzt auch die Spalte mit dem Text in ChurchTools; vorher blieb sie stehen. Ebenso beim Ändern des Fragetyps.

### Intern (Anmeldungen)

- Eine Regel für die Liste (`shared/anmeldung/zeilenListe.ts`): Zustand einer Zeile, Zahlen wie in Deutschland getippt, Summe, lesbarer Text und „(Daten)“ für ChurchTools, Längenprüfung gegen 4.000 Zeichen. Messung M9: Ohne Login kürzt ChurchTools lange Texte still auf 4.000 Zeichen – `GRUPPENFELD_MAX` in `feldwert.ts` ist jetzt die eine Stelle für diese Zahl (auch Unterschrift), `zahlText` die eine für Zahlen (vorher zwei Kopien).
- Weitere Spalten eines Felds (`zusatzSchluessel`): Fällt eine weg (Summe aus), kommt sie aus dem Anmeldeformular; beim Löschen und beim Wechsel des Fragetyps gehen alle mit.
