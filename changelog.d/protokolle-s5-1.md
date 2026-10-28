### Neu (Protokolle, S5-1)

- **Protokoll beginnen** (Alwin 28.10.2026, Entwurf 7): Hat eine Sitzung (Termin mit Besprechungsanfrage oder
  Gruppentreffen) noch kein Protokoll, bietet die Sitzungsansicht der Leitung „Protokoll beginnen“ an. Im Fenster wählt
  man eine **Vorlage**, **„Wie letztes Mal“** (Tagesordnung des letzten freigegebenen Protokolls, ohne dessen Notizen)
  oder **„Leer“** – vorbelegt ist „Wie letztes Mal“, sonst die erste Vorlage. Danach öffnet sich das Protokoll gleich
  im Editor; die festen Aufgaben der Vorlage sind sofort To-Dos.
- Hat inzwischen jemand anderes dasselbe Protokoll begonnen, sagt das Fenster das und öffnet dessen Protokoll – es
  entsteht kein zweites.

### Behoben (Protokolle)

- **Serientermine:** Ein Protokoll hing an allen Terminen einer Serie (sie haben in ChurchTools dieselbe ID) – jetzt
  nur am Termin zu seinem Beginn; ein einzelner, verschobener Termin bleibt bei seinem Protokoll. Beim Bau von S5-1
  gefunden, bevor es auftreten konnte (bisher legte die Erweiterung keine Köpfe zu Terminen an).

### Intern (Protokolle, S5-1)

- Regel `shared/protokolle/beginnen.ts` (`anfangsDokument`, `neuerKopf`), Zuordnung `gehoertZu` in
  `shared/protokolle/sitzungen.ts` (eine Stelle für `sitzungenOrdnen` und „beginnen“); Schreiben
  `protokolle/src/beginnen.ts`: frisch lesen → Teile → nachlesen → Kopf → nachlesen → To-Dos (scheitern nur diese, steht
  das Protokoll und das nächste Speichern holt sie nach). Ein geplanter Kopf wird umgestellt statt ein zweiter angelegt.
