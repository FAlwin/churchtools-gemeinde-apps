### Neu (Anmeldungen, A8-1)

- **Druckliste: Teilnehmer als PDF** (Entwurf `a8-druckliste-v1`, abgenommen 23.10.2026). Knopf „⎙ Druckliste“ im
  Reiter „Anmeldungen“: Spalten aus den Fragen des Formulars, Sortierung (Nachname, Alter, Anmeldung), Warteliste
  zuschaltbar, Vorschau im Fenster, „Teilen …“ und „Herunterladen“. Kopf mit Gemeinde · Veranstaltung · Liste, Fuß mit
  Stand und „Seite x von y“ auf jeder Seite; der Tabellenkopf wiederholt sich, ab sechs Spalten quer. Die Wahl der
  Spalten merkt sich die Veranstaltung (neues, freiwilliges Feld `druck` in den Einstellungen).
- Neuer Baustein `ui/teilen/listenPdf.ts` für Listen als PDF (jsPDF wird erst beim Öffnen geladen); die Antwort als Text
  (`antwortText`) teilen sich jetzt das Fenster einer Anmeldung und die Druckliste.
