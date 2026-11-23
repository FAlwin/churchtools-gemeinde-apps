### Neu (Protokolle)

- **Ressourcen buchen beim Eintragen in den Kalender (W15-2).** Im Fenster „In Kalender eintragen“ gibt es jetzt – wie im ChurchTools-Dialog „Termin erstellen“ – den Reiter
  **„Ressourcen“** neben „Kalender“ (nur, wenn du in ChurchTools mindestens eine Ressource buchen darfst). Oben **Vorlauf** und **Nachlauf** (Minuten, frei tippbar oder aus den Vorschlägen
  0 bis 240; Vorgabe 15/15) mit der errechneten Uhrzeit daneben („23.11.2026 13:45“). Darunter **Ressource** wählen („Saal · Raum“, nach Typ gruppiert, nur die, die du buchen darfst) – sie
  landet mit dem aktuellen Vorlauf/Nachlauf in der Tabelle **„Vorhandene Buchungen“**: je Zeile eigener Vorlauf und Nachlauf, **Status** („Wartet auf Bestätigung“, „Bestätigt“, „Abgelehnt“ –
  wählbar nur bei Ressourcen, die du in ChurchTools verwalten darfst, sonst steht fest „Wartet auf Bestätigung“), ✕ zum Entfernen und bei Ressourcen mit mehreren Stück (Stühle) die **Anzahl**.
  Am Handy wird jede Zeile zur Karte.
- **Termin-Vorlagen mit Buchungen** füllen die Tabelle (nur Ressourcen, die du buchen darfst; Status ohne Verwalten-Recht „Wartet“); **„Als Vorlage speichern“** schreibt die Buchungen mit.
- **Ehrlich nachgelesen:** ChurchTools meldet das Anlegen auch dann als erfolgreich, wenn eine Buchung nicht entsteht. Nach dem Speichern liest die Erweiterung die Buchungen nach. Fehlt eine, bleibt
  der Termin stehen, der Vermerk im Protokoll entsteht trotzdem, und das Fenster sagt, welche Ressource du in ChurchTools nachbuchen musst („Fertig“ schließt es). Ließ sich das Nachlesen nicht
  erledigen, steht das ausdrücklich da – nicht als „nicht gebucht“.
- Bei **„Nur verknüpfen“** wird nichts gebucht – der Reiter sagt es und ist gesperrt; „Trotzdem neu anlegen“ schaltet ihn wieder frei.

### Intern (Protokolle)

- Regeln ohne Oberfläche: `shared/protokolle/terminRessourcen.ts` (Status, Grenzen, `ressourcenAus`, `buchungHinzu`, `buchungenAufRechte`, `buchungRumpf`, `buchungsHinweis`),
  `terminRessourcenZeit.ts` (errechnete Uhrzeit), Rechte `shared/ct/ressourcenRechte.ts` (`churchresource` „create bookings“ / „administer bookings“, über `start.ts` bis ins Fenster).
  `Eintrag` trägt `vorlauf`, `nachlauf`, `buchungen`; `terminRumpf` schreibt `bookings`; Vorlagen lesen/schreiben das Altformat `{resource_id, minpre, minpost, status_id}`. Lesen und
  Nachlesen: `protokolle/src/buchungenLesen.ts` (`ladeRessourcen`, `buchungenNachlesen` – je Ressource einzeln, ein Lesefehler ist „unklar“), `terminLegen` liefert `buchungen`. Oberfläche
  `TerminRessourcen.tsx`. Der Testnachbau und `?demo` kennen Ressourcen, Typen und Buchungen.
