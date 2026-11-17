### Neu (Dienstplaner)

- **Anfrage oder direkt – eine Vorgabe je Dienst.** In der Matrix steht am Dienstnamen ein kleines blaues Symbol: „?“ = neue
  Einteilungen beginnen als Anfrage, Haken = direkt (ohne Rückfrage als zugesagt, z. B. für Prediger). Antippen öffnet ein kleines
  Fenster „Vorgabe · Ton“ mit „Anfrage | direkt“ und „Für alle Dienste übernehmen“ – umgeschaltet wird nie per Klick am Symbol.
  Die Vorgabe gilt je Gerät (im Browser gemerkt) und für neue Entwürfe aus „Wer kann?“, „Personen“ und dem Zauberstab; bestehende
  Entwürfe bleiben, wie sie sind. Dasselbe Symbol steht in „Personen“ im Kopf jedes Dienst-Blocks, neben dem Zauberstab.
- **Personen: Klick-Zyklus.** Leere Zelle → Entwurf als Anfrage („?“), ein zweiter Klick stellt ihn auf direkt (Haken), der dritte
  nimmt ihn weg. Steht der Dienst auf „direkt“, beginnt schon der erste Klick direkt. Das Warnfenster kommt nur beim ersten Klick.
  In den Zellen sieht man den Unterschied: „?“ blass, Haken kräftig.

### Geändert (Dienstplaner)

- **Personen: Abwesenheit als Schraffur.** Die Zelle einer abwesenden Person ist schraffiert, der Grund steht nur als Text mit
  Symbol (kein Kasten mehr); im Dunkelmodus dieselbe Schraffur in der helleren Farbe. Abwesend **und** eingeteilt: rote Schraffur
  und ein roter Rahmen um die ganze Zelle, davor nur das durchgestrichene Symbol (der Grund steht im Tooltip und im Warnfenster).
- Das Wort heißt überall „direkt“; „Ansehen und senden“ zeigt je Entwurf „Anfrage“ bzw. „Direkt zuteilen“ zur Kontrolle.
- Der Hilfetext unter „Planen“ erklärt das Symbol, den Klick-Zyklus und die Schraffur.

### Intern (Dienstplaner)

- Neue Rechnung `shared/dienstplan/modusVorgabe.ts` (Vorgabe je Dienst); der Modus eines Entwurfs wird über **eine** Funktion
  geändert (`modusAendern`) – fürs Entwurfs-Fach und für den Klick in „Personen“. Neue Farb-Tokens `--abw-*` und `--symbol-tinte`.
