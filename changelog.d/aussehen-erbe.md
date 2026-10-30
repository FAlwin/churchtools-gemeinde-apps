### Neu (Musik-App)

- **„Lieder öffnen mit: Akkorde & Text | Nur Text“** unter „Mehr › Während des Spielens“ (Alwin, 30.10.2026: „Für
  Sänger würde es Sinn machen, dass man voreinstellen kann, dass immer Nur Text als erstes gewählt ist“). Mit „Nur
  Text“ öffnet jedes Lied ohne Akkorde, an dem man selbst noch nichts gewählt hat; wer an einem Lied „Akkorde & Text“
  wählt, behält das für dieses Lied. Die Wahl gilt **auf allen eigenen Geräten** und geht der Gemeinde-Einstellung
  „PDF zuerst“ vor. Ein Lied ohne Text zeigt weiter sein Dokument.

### Behoben (Musik-App)

- **Nach dem Speichern im Editor sieht das Lied aus wie vorher** (Alwin, 30.10.2026: „soll bitte genau die Ansicht,
  mit dem gleichen Aussehen von vorher erscheinen, nicht wieder zurück in die Ursprungsansicht“). Schrift, Spalten
  und „Nur Text“ gelten je Version – eine im Editor neu gespeicherte Version startete deshalb mit Schrift 20, einer
  Spalte und Akkorden. Jetzt übernimmt sie Schrift, Spalten, Nur Text, Kapo und Zählweise der Version, aus der sie
  entstand. Dasselbe beim Umbenennen einer Version (neuer Name = neuer Schlüssel): dort geht alles mit, auch Tonart und
  Abschnitts-Transponierung.

### Intern (Musik-App)

- `einstellungenMitnehmen` in `utils/songVersions.ts` (vor `selectVersion`, nichts überschreiben, über `setLsVersion`
  auch ans Konto). Persönliche Konto-Einstellungen unter der Pseudo-Lied-ID `KONTO_ID = 0` (`worship_start_0`, neue
  Einstellungsart `start` in `SETTINGS_BASES`): `pullSettings` fragt sie immer mit, `GET /api/settings` ergänzt sie;
  Team-Notizen fragen nur echte Lieder ab und nehmen sie nie mit. Regel in `standardAnsicht.ts` (`liedStart`,
  `standardQuelle`), angewandt in `loadSettings` – damit auch in „Als PDF teilen“ und im Ablauf-PDF.
- Bekannt, nicht behoben: Anmerkungen einer umbenannten Version bleiben unter dem alten Schlüssel liegen.
