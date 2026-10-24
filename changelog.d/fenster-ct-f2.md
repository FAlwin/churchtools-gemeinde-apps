### Geändert (Dienstplaner, E6-O F2)

- **Alle Fenster des Dienstplaners im ChurchTools-Aufbau** (#720): Titel links, **X rechts**, Knöpfe **rechts unten**.
  „Einteilungen senden“, „Alte Entwürfe“, „Vorlieben“ und der Zauberstab haben ihren Hauptknopf jetzt unten rechts
  neben „Abbrechen“. „Wer kann?“, belegter Platz, Entwurf und „Plätze“ haben unten nur „Schließen“.
- **Während etwas läuft** (senden, verwerfen, speichern, eintragen, Plätze ändern) sind X und „Abbrechen“ sichtbar
  gesperrt. Was gerade passiert, zeigt der Hauptknopf oder der Titel – kein „Bitte warten …“ mehr im Abbrechen-Knopf.
- **Zauberstab:** „Neu vorschlagen“ steht als Link oben neben „N Vorschläge“, unten nur noch Abbrechen und Übernehmen.
- **Vorlieben:** Die Auswahlfelder bekommen im Fokus den blauen Rand mit Schein wie alle Felder.

### Geändert (alle Apps, E6-O F2)

- **Am Handy stehen die Knöpfe unten in jedem Fenster untereinander**, über die volle Breite, der Hauptknopf oben – auch
  in allen Bestätigungen. Am Rechner bleibt alles nebeneinander rechts unten.
- Das X oben rechts heißt für Screenreader jetzt „Fenster schließen“, damit es sich vom Knopf „Schließen“ unterscheidet.

### Intern (E6-O F2)

- Neue Mixins `fensterX`, `fensterKnopfZeile` und `textKnopf` in `ui/design/_mixins.scss` statt je einer Kopie in
  `Sheet`, `ConfirmDialog` und den Fenstern; die vier nachgebauten `.primaer`-Knöpfe der Dienstplaner-Fenster sind weg.
- `Sheet` hat `beschaeftigt` (wie `ConfirmDialog`) und nimmt `knoepfe={null}` für Fenster nur zum Ansehen.
