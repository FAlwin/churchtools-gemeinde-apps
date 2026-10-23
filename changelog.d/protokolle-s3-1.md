### Neu (Protokolle, S3-1)

- **Lese-Kern ohne Oberfläche** (`protokolle/src/lesen.ts`, Regel `shared/protokolle/sitzungen.ts`): die Sitzungen
  einer Gruppe aus Protokoll-Köpfen, Terminen im Kalender der Gruppe und Gruppentreffen – „Kommend“ (alles noch
  nicht Freigegebene) und „Protokolle“ (freigegeben, neueste zuerst). **Nur Termine mit Besprechungsanfrage**
  (Alwin, 23.10.2026); ChurchTools zeigt das nur je Termin (`…/meetingrequests`, gemessen – auch Mitglieder dürfen
  es lesen). Termin und Treffen zur selben Minute sind eine Sitzung. Darf jemand die Gruppentreffen nicht sehen
  (403, je nach Gruppentyp), fehlen nur die Treffen, und das wird gemeldet. Dazu die Aufgaben einer Gruppe (ohne
  gelöschte) und Prüfer für Kopf und Teil (`istKopf`, `istTeil`). Gegen die Test-Instanz mit Test-Protokollen im
  echten Speicherformat geprüft. Die Oberfläche folgt mit S3-2.
