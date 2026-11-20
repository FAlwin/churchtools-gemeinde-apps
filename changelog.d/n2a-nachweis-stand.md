### Intern (Anmeldungen)

- **Nachweise: der Stand je Person wird gelesen und angezeigt** (Etappe F, Scheibe N2a „Stand lesen“; veröffentlicht wird
  erst nach Etappe F). Entwurf `n2-stand-v1`, nur lesen – „Einsicht festhalten“ und „Fällige anschreiben“ kommen mit
  N2b und N2c.
  - **Seite „Nachweise“:** je Nachweis-Art eine Karte. Im Kopf stehen Gültigkeit, „mit/ohne Antrag“ und die
    Vertrauenspersonen (die frühere Liste „Nachweis-Arten“ geht darin auf), „Nachweis-Art bearbeiten“ liegt im „⋯“-Menü
    (nur mit „Berechtigungen verwalten“). Darunter die Personen: am Rechner eine Tabelle (Name, Stand, Eingesehen am,
    Ausgestellt am, Gültig bis), am Handy eine Liste. Wer dich braucht, steht oben (rot vor blau, dann angefordert, dann
    gültig). Oben links die Ansicht „Alle | Braucht Aufmerksamkeit“ (Adresse `#/nachweise/aufmerksam`).
  - **Der Stand** (eine Regel-Datei, `shared/anmeldung/nachweisStand.ts`, „heute“ als Parameter): angefordert (bis 28 Tage),
    fehlt seit N Wochen (älter), gültig, läuft ab (Ablauf in 0–56 Tagen, blau), abgelaufen, Rücksprache (Ergebnis
    „Eintragung“ schlägt jedes Datum), noch keine Aufgabe, Angaben unvollständig. „Gültig bis“ = Ausstellung bzw. Einsicht
    plus Jahre der Art (29.02. → 28.02.).
  - **„Antrag unvollständig“** (rot unter dem Namen) – nur bei Arten mit Antrag und solange die Person ihn braucht: fehlt das
    Geburtsdatum und/oder die Adresse im ChurchTools-Profil. Lässt sich das Profil nicht lesen, gibt es keinen Hinweis statt
    eines falschen Alarms.
  - **Startseite:** „Braucht deine Aufmerksamkeit“ bekommt je Art mit Fällen eine Zeile (fehlt / läuft bald ab /
    abgelaufen / Rücksprache, dazu „N Personen brauchen dich als Vertrauensperson.“); die Karte „Nachweise“ zeigt je Art die
    Zählung („7 Personen: 2 gültig · 1 angefordert · 4 brauchen dich“). Scheitert das Lesen der Personen, bleibt die Karte
    wie bisher, ohne Zahlen.
  - **Gelesen** wird aus den Gruppenfeldern „Eingesehen am“, „Ausgestellt am“, „Ergebnis“ (nach Namen; die Auswahl kommt als
    Nummer der Option), den Folgeaufgaben der Gruppe („Einsicht nehmen“, „Erneut einsehen“; offen = nicht erledigt;
    „angefordert am“ aus dem Anlagedatum in der Uhr der Gemeinde) und – nur bei Arten mit Antrag – Geburtstag und Adresse.
    Die Folgeaufgaben werden seitenweise gelesen (mit jeder Erneuerung kommen erledigte dazu; `limit`/`page` greifen,
    gemessen 20.11.2026). Ein 403 heißt „für dich nicht sichtbar“, jeder andere Fehler wird gemeldet, nicht als „niemand“
    gezeigt. Admins sehen alle Arten, Vertrauenspersonen nur die, die sie leiten – fremde Arten fehlen auf der Seite ganz.
  - Die Titel der beiden Folgeaufgaben stehen jetzt an einer Stelle (`NACHWEIS_AUFGABE_ERSTE/ERNEUT`), Ablauf und Stand lesen
    dieselben.
  - **Demo:** Die Art „Führungszeugnis“ hat sechs Teilnehmer, je einer pro Stand (fehlt, Rücksprache, abgelaufen, läuft
    ab, angefordert, gültig), dazu Folgeaufgaben; `?demo=vertrauen` leitet sie.
