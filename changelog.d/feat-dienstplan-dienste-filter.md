### Neu (Dienstplaner)

- **Planen: einzelne Dienste ausblenden.** Im Filter steht unter jeder Gruppe mit mehreren Diensten die Liste ihrer
  Dienste, jeder mit eigenem Haken (zum Beispiel Technik ▸ Ton, Bild, Licht). Wer nur Bild nicht sehen will, hakt Bild ab –
  die übrigen Dienste der Gruppe bleiben. Der Haken der Gruppe zeigt dann einen Strich; ihn antippen schaltet alle Dienste
  wieder ein. Sind alle Dienste einer Gruppe einzeln abgehakt, verhält sich die Gruppe wie „aus“.
  - Der Filter gilt für **Matrix, „Personen“ und „Wer wie oft?“**; ein ausgeblendeter Dienst hat dort keine Zeile und keinen
    Block. Termin-Kopf, Füllbalken, Handy-Zettel, die Zeile der Gruppe, „Noch offen“ und das Teilen als PDF zählen nur
    gezeigte Dienste. In „Personen“ steht ein ausgeblendeter Dienst am selben Tag blass als „+ Bild“ (ist die ganze Gruppe
    ausgeblendet, wie bisher „+ Ton (Technik)“).
  - Das Gerät merkt sich die Wahl wie die Gruppen. Ein Besuch von der Startseite („Nur Technik · nächste 6 Wochen“) zeigt
    trotzdem alle Dienste der Gruppe, nur für diesen Besuch; der gemerkte Filter bleibt unverändert. Der Regler in der
    Gruppenzeile (Plätze) zeigt weiter alle Dienste der Gruppe.
  - In **„Personen“** lässt sich jeder Dienst-Block zuklappen (Kopf „Bild · 5 Personen“ antippen). Zuklappen ist kein
    Ausblenden: „Noch offen“ zählt den Dienst weiter, gemerkt wird es nicht (wie bei den Gruppen der Matrix).
  - Technik: Die Regel „ist ausgeblendet“ steht an einer Stelle, `shared/dienstplan/planFilter.ts` (`gezeigteGruppen`),
    daraus rechnen Matrix, Raster, „Wer wie oft?“, Kopf, Zettel und Teilen. `FilterKnopf` kennt dafür eine Unterliste
    unter einer Möglichkeit.
