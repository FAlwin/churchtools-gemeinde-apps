### Neu (Dienstplaner, T2b – Alwin, 02.11.2026)

- **Dateien am Termin ändern** – wer den Termin ändern darf, hängt im Fenster „Dateien“ über **„Anhang hinzufügen“**
  Dateien an (auswählen oder hineinziehen, mehrere auf einmal) oder einen **Link** (Name und Adresse). Ein Tipp auf eine
  Datei zeigt – wie in ChurchTools – ein **kleines Fenster** mit Art, Größe, wann und von wem angehängt und **Öffnen**,
  **Umbenennen** (die Endung bleibt) und **Löschen** (mit Rückfrage). Wer nicht ändern darf, öffnet die Datei direkt.
  Dateien über **128 MB** stehen sofort rot da und gehen gar nicht erst hoch (ChurchTools lehnt sie sonst erst nach dem
  kompletten Hochladen ab); jede Datei zeigt beim Hochladen einen **Fortschritt in %**. Die Büroklammer steht für
  Berechtigte auch an Terminen ohne Dateien und öffnet dann gleich „Anhang hinzufügen“. Ohne „Hochladen und E-Mail
  schreiben“ – das kommt mit E8. Testfall TF-ABLAUF-19.
- Große Dateien brechen nicht nach einer festen Zeit ab: Die Zeitgrenze gilt für **Stillstand** (60 s ohne
  Fortschritt). Und nach einem Abbruch liest der Dienstplaner erst nach, ob die Datei trotzdem angekommen ist, bevor er
  „fehlgeschlagen“ sagt – sonst lädt man sie zweimal hoch. Jede Änderung zählt erst, wenn ChurchTools sie beim
  Nachlesen zeigt.

### Intern (alle Apps)

- Die Prüfung vor dem Hochladen (leer, zu groß, gleicher Name) steht jetzt in `@shared/dateien` (`pruefeHochladen`, die
  Grenze gibt die App mit); die Musik-App benutzt sie mit ihren 50 MB. `ui/ct/verbindung` hat `ctHochladen` – Hochladen
  mit Fortschritt nach denselben Regeln wie `ctAnfrage` (Bremse, CSRF-Token, Fehlerübersetzung).

### Geändert (Dienstplaner)

- **Matrix, „Infos & Dateien“ wie in ChurchTools:** Oben in jeder Zelle die Knöpfe **ⓘ** (Weitere Infos – hellblau,
  wenn es welche gibt) und **Büroklammer** (Anhang hinzufügen); darunter der Infotext grau hinterlegt zum Lesen und
  „Anhänge:“ mit den Dateien. Vorher sah man einem vorhandenen Text nicht an, dass er sich bearbeiten lässt (Alwin,
  03.11.2026, Entwurf `matrix-infos-bearbeiten.html` Variante D1). Ersetzt „+ Infos“ und „+ Datei“. ⓘ und Büroklammer
  sind – auch im Kopf der Termin-Ansicht – genau die Zeichen von ChurchTools (dessen Font Awesome, nichts kopiert).

### Behoben (Dienstplaner)

- **Die Matrix zeigt nach Änderungen in der Termin-Ansicht den neuen Stand:** Wer dort Infos speicherte oder Dateien
  änderte und mit „‹ Planen“ zurückging, sah bis zum Neuladen der Seite noch die alten (beim Prüfen von T2b in der
  Test-Instanz aufgefallen; die Infos betraf es seit T1). Jetzt lädt der Dienstplaner die Termine danach leise neu.
