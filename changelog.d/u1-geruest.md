### Geändert (Anmeldungen, U1 – Seitengerüst)

- **Zwei Bereiche statt drei Reiter** – „Vorbereiten“ (Termin, Anmeldung, „Wer meldet sich an?“, Formular, Preise,
  Bezahlung, Mails, Datenschutz, nach der Freigabe der Anmeldelink) und „Anmeldungen“. Ohne Angabe in der Adresse öffnet
  ein Entwurf „Vorbereiten“, eine freigegebene Veranstaltung „Anmeldungen“ (Alwin, 28.10.2026, Entwurf `ux-umbau-v1`).
  Der Baukasten öffnet sich über die Karte „Formular“; „‹ Zurück“ oder der Reiter „Vorbereiten“ führen zurück.
- **Einstieg je nach Stand** (Variante D) – vor der Freigabe eine Schrittleiste mit dem nächsten Schritt und einem
  Knopf dafür (Termin, Anmeldebeginn, Bankverbindung, Freigeben); danach Kennzahlen (Plätze, Warteliste, Zahlung offen,
  Anmeldeschluss), ein Klick öffnet die passende Ansicht der Liste. Hervorgehoben nur die Warteliste, wenn trotz freiem
  Platz jemand wartet. Die Zahlen standen vorher oben im Reiter „Anmeldungen“ – gezählt wird weiter mit `listenZahlen`.
- **Einheitliche Knöpfe** – die eigenen Knopfarten der Erweiterung sind durch die gemeinsamen aus `ui/` ersetzt
  (`FensterKnopf`/`FensterLink`, `KopfKnopf`, `ZeilenKnopf`); eine Dauerprüfung (`ui/design/knoepfeAnmeldungen.test.ts`)
  meldet jede neue eigene Knopfart. Die Nachprüfung ohne Hinweise steht jetzt unten bei den Anmeldungen.
