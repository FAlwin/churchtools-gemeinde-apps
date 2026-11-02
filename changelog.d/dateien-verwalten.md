### Neu (Musik-App)

- **Dateien umbenennen** (Alwin, 30.10.2026: „wäre gut, wenn man die hochgeladenen Dateien irgendwo direkt umbenennen
  könnte“; Entwurf „Auswahl, Anzeige & Dateien“, Board 3). In **„Dateien verwalten“** hat jede Zeile einen **Stift**
  neben dem Papierkorb. Das Fenster zeigt den Namen zum Ändern und die **Endung fest daneben** – aus einem PDF wird
  kein Text. Der neue Name gilt für alle, in der App und in ChurchTools; eine gewählte Datei bleibt gewählt, Anmerkungen
  auf einem PDF bleiben (beides hängt an der Datei, nicht am Namen).
  - **Eine Version aus dem Editor** wird dort ebenso umbenannt: Im Feld steht nur ihr Name, und Tonart, Aussehen und
    die eigenen Anmerkungen gehen mit – wie beim Umbenennen im Editor.
  - Ein Name, unter dem das Notenblatt zur Version würde („… (App)“), geht nicht; ebenso nicht der Name einer anderen
    Datei daneben. Was ChurchTools ablehnt, steht im Fenster.

### Intern (Musik-App)

- `PATCH /files/<id> {name}` gemessen an der Test-Instanz (31.10.2026, `musik-planung/docs/messung-datei-umbenennen-31.10.md`,
  Mess-Skript `server/scripts/probe-datei-umbenennen.ts`): 204, Name wirklich geändert, ID/Adresse/Inhalt bleiben.
  `dateiUmbenennen` im geteilten Kern (Server und Erweiterung) liest danach nach – ein 204 ohne Wirkung wird zum Fehler.
  Neue Route `PATCH /api/songs/:songId/arrangements/:arrangementId/files/:fileId`. Die Namensregel `neuerDateiname`
  gilt im Fenster und im Kern. Was beim Umbenennen einer Version mitgeht, steht jetzt an einer Stelle
  (`umbenannteVersionMitnehmen`) – Editor und Dateiverwaltung rufen beide sie. Der E2E-Stub benennt wie ChurchTools
  wirklich um; `e2e/dateien-umbenennen.spec.ts` geht die Kette mit echtem Server durch (und ist der einzige Test, der
  die Route selbst bemerkt). Gegenprobe: 21 Teile einzeln zurückgenommen, jeder macht Tests rot. TF-EINST-09,
  TF-EXT-05.
