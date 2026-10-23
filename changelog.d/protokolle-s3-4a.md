### Intern (Protokolle, S3-4a)

- **Such-Kern für die globale Suche** (`shared/protokolle/suche.ts`, noch ohne Oberfläche): ein Index über
  Beschlüsse, Termine und Protokolltext aus **freigegebenen** Protokollen und über die To-Dos **aller** Protokolle
  (gelöschte nie), je mit Gruppe, Sitzung und Tagesordnungspunkt aus derselben Ableitung wie im Protokoll. Suchen
  nach Art und Gruppe, alle Wörter müssen vorkommen (auch im Punkt und im Sitzungstitel); ohne Suchbegriff die
  Beschlüsse. Dazu die Fundstellen zum Hervorheben.
- `dokumentDerSitzung()` in `shared/protokolle/speicher.ts` ist die eine Stelle für „ein geplantes Protokoll hat noch
  kein Dokument“ – vorher stand die Regel in der Ansicht, jetzt nutzen Ansicht und Suche dieselbe.
