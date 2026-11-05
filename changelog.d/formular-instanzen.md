### Behoben (Anmeldungen)

- **Das öffentliche Formular spricht nur noch die ChurchTools-Instanzen der Gemeinde an** (#843). Bisher nahm es
  jede Instanz aus dem Link: Wer einen Link `…/#fremde-seite/1` verschickte und dort eine nachgebaute Schnittstelle
  hinstellte, zeigte unter der Adresse der Gemeinde ein fremdes Formular – mit fremder IBAN, und die Eingaben gingen
  an ihn. Jetzt liegt neben `index.html` eine Liste `instanzen.json`; ein Link auf eine andere Instanz zeigt „Diese
  Anmeldung gibt es hier nicht“, ohne die fremde Seite zu fragen. Das gilt beim Laden, Anmelden und für „Deine
  Anmeldung“. **Beim Aktualisieren einmal `instanzen.json` anlegen** (siehe `docs/betrieb/ANMELDUNGEN.md`) – ohne
  sie zeigt das Formular „noch nicht eingerichtet“. Das Paket enthält sie bewusst nicht, damit ein Update eure Liste
  nicht überschreibt; als Vorlage liegt `instanzen.beispiel.json` bei.

### Intern (Anmeldungen)

- `npm run formular:hochladen` braucht `ANMELDUNG_CT_INSTANZEN`, schreibt daraus `instanzen.json`, lädt sie vor
  `index.html` hoch und liest sie im Netz nach; der Ordner-Schutz kennt die Datei.
