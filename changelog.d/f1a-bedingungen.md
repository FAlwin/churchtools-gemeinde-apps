### Intern

- **Anmeldungen: Bedingungen im Formular – der Regel-Baustein** (Etappe F, Scheibe F1a; noch ohne Oberfläche).
  Neue Datei `shared/anmeldung/bedingungen.ts` als die EINE Stelle für „Nur zeigen, wenn …“. Fragen und einzelne
  Antworten können eine Bedingung bekommen (`bed`, `antwortBed`; Antwort sonst ausgegraut mit Hinweis oder
  ausgeblendet). Dazu ein freiwilliger Kurzname (`kurz`).
  - Vergleiche: ist, ist nicht, enthält, enthält nicht, ausgefüllt, leer; mit „eine reicht / alle müssen“.
  - Quellen nur davor; eine Frage je Person darf auch auf Kontakt-Fragen schauen. Ausgeblendete oder ausgeschaltete
    Quellen zählen als nicht erfüllt.
  - Pflicht gilt nur, solange die Frage zu sehen ist (`pruefeAntworten`). `leeren` löst ungültige Antworten und leert
    Ausgeblendetes, auch über mehrere Stufen. `bedingungFehler` verhindert das Speichern kaputter Bedingungen
    (`pruefeFormular`).
  - Höchstzahl der Felder je Teil von 30 auf 60 (`FELDER_MAX`): Die AC-Mitarbeiter-Anmeldung braucht rund 37. Ein
    Test belegt, dass sie samt Bedingungen in die 5.000 Zeichen passt.
  - „Ja/Nein“ (`wahlAntworten`) und die Antwort-Länge (`ANTWORT_MAX`) stehen jetzt an einer Stelle statt an zwei.
  - Ein älteres Formular-Paket liest die Bedingungen nicht. Paket und Erweiterung deshalb zusammen hochladen.
