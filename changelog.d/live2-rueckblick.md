### Neu (Dienstplaner)

- **Rückblick im Termin** (Live-Ansicht 2, L4-4): Ist „Live“ zu Ende, steht unter dem Ablauf die Karte „Rückblick · Live am TT.MM.“ – Beginn und Ende gegen den Plan, „Am meisten eingeholt“ und „Am meisten überzogen“, dazu je Punkt Plan, Gelaufen, ± und „Ø bisher“, nach den Abschnitten des Ablaufs. Für alle, die den Ablauf sehen; am Handy rutschen die Zahlen unter den Titel.
- **Ø bisher:** der Durchschnitt gleichnamiger Punkte aus allen Terminen mit Rückblick (alle Lieder zählen zusammen als „Lied“) – beim Anzeigen gerechnet, kein zweiter Speicher. Dasselbe leise „Ø m:ss“ steht beim Ablauf bearbeiten unter der Dauer.
- **Aus dem Schnitt nehmen:** Planer nehmen über „⋯“ einen Punkt oder den ganzen Termin aus dem Schnitt (und wieder hinein), wenn jemand das Weiterklicken vergessen hat. Die Markierung wird zusammengeführt gespeichert – zwei Geräte schreiben sie sich nicht weg.
- Demo (`?demo`): drei vergangene Gottesdienste mit Live-Verlauf (`#/termin/108` zeigt den Rückblick).

### Intern (Dienstplaner)

- `shared/ct/liveRueckblick.ts` (Rückblick und Schnitt), `gelaufenJePunkt` als eine Rechnung für ± und Rückblick, Lied-Merkmal am Wechsel; die Ablage „Live-Verlauf“ trägt zusätzlich die Markierungen (`x`); alle Verläufe werden einmal je Seitenaufruf gelesen. Die Schalter für „Meine Anzeige“ (L4-5) sind vorbereitet (`meineAnzeige.ts`, Standard alles an).
