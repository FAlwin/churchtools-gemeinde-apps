### Intern

- **Ablaufvorlagen: der Kern zum Bearbeiten steht (E10-V1, noch nichts Sichtbares).** Der Schreib-Kern (`shared/ct/schreibKern.ts`)
  schreibt jetzt auch in eine Ablaufvorlage (Ziel `{ vorlageId }` statt Termin-ID, Pfad `/agendatemplates/{id}`) –
  dieselben Regeln wie beim Ablauf eines Termins, keine zweite Fassung. Neu in `shared/ct/ablaufVorlagen.ts`: Vorlage
  anlegen, umbenennen, löschen, den Ablauf eines Termins als neue Vorlage speichern und eine Vorlage damit ersetzen
  (je ein Aufruf an ChurchTools, danach nachgelesen und nachgezählt). Dazu die Regel `darfVorlageBearbeiten` für das neue
  Recht „Ablaufvorlagen bearbeiten“ (`edit agenda templates`, je Kalender) und der Eintrag in der Rechte-Übersicht.
- **Lied ohne Arrangement:** Jeder Schreibweg für Ablaufpunkte (`agendaItemWritePayload`, Anlegen, Zurückholen nach
  dem Löschen) schickt bei einem Lied ohne Arrangement jetzt `arrangementId: null` mit. Fehlt das Feld, lehnt
  ChurchTools den Punkt mit 400 ab – gemessen an Vorlagen (Umsortieren und Ändern scheiterten an so einem Lied); laut
  Schnittstellenbeschreibung gilt dieselbe Pflicht für Termin-Abläufe.
