### Neu (Dienstplaner)

- **Personen: Zauberstab je Dienst.** Im Kopf jedes Dienst-Blocks steht neben „N Personen“ ein Zauberstab. Er schlägt für die
  **freien Plätze dieses Dienstes an allen gezeigten Terminen** Personen vor – im selben Fenster wie der Zauberstab der Matrix
  („Automatische Planung · Ton“), übernommen als Entwürfe. Abgesagte und vergangene Termine füllt er nicht, Plätze mit Entwurf
  bleiben, wie sie sind. Wo in dem Dienst nichts zu füllen ist oder man ihn nicht planen darf, gibt es keinen Knopf.
  Die Entwürfe stehen danach in „Personen“, zählen bei „Einsätze“ und „Noch offen“ mit und kommen in „Ansehen und senden“.

### Intern (Dienstplaner)

- Matrix und „Personen“ nutzen **dieselbe** Zauberstab-Rechnung: `onZauberstab(spalten, gruppe, dienstId?)` bzw.
  `zauberZeilen(…, dienstId?)` – ohne Dienst die ganze Gruppe, mit Dienst nur dessen Plätze.
