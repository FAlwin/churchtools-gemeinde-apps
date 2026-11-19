### Geändert (Protokolle)

- **Vorschläge in Kurzform.** In der Karte „Vorschläge“ (Reiter „Sitzungen“) und im Kasten beim Protokollschreiben steht jeder
  Vorschlag als eine Zeile: Titel, darunter höchstens eine Zeile Text und „von …“. **Antippen klappt ihn auf** – erst dann stehen
  der ganze Text und die Knöpfe (Ändern, Zurückziehen, Übernehmen, Nächstes Mal, Ablehnen) da; aufgeklappt ist immer nur einer.
- **Karte einklappbar.** Der Kopf „Vorschläge · n offen“ klappt die Karte zu und auf: Standard offen, wenn es offene gibt, sonst
  zu. Das Gerät merkt sich die Wahl (je Person und Gruppe).
- **Übernommene verschwinden aus der Liste.** Stattdessen trägt die Sitzung in „Kommend“ die Marke „n Vorschläge übernommen“;
  die Marke für die offenen heißt jetzt „n Vorschläge offen“. Zurückgezogene stehen ebenfalls nicht mehr in der Liste.
- **Abgelehnte bleiben 7 Tage.** In einer kleinen Gruppe „Abgelehnt · verschwindet nach 7 Tagen“, nur für den, der vorschlug, und
  die Leitung – mit „Grund: …“ und „noch n Tage sichtbar“. Ein „×“ blendet einen früher aus (nur auf diesem Gerät). Gespeichert
  bleibt alles; nichts wird gelöscht. Die Gruppe „Erledigt“ mit 60 Tagen entfällt.

### Intern (Protokolle)

- Die Regeln (nur Offene in der Karte, übernommen je Sitzung, 7-Tage-Sichtbarkeit in Ortszeit der Gemeinde, Einklapp-Standard)
  stehen als Funktionen in `shared/protokolle/vorschlaege.ts` und sind dort getestet; die Sitzungszeile nutzt `offeneFuer`
  statt einer eigenen Nachrechnung.
