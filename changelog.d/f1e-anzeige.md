### Intern

- **Anmeldungen: Bedingungen auf gespeicherten Anmeldungen** (Etappe F, Scheibe F1e; noch nicht freigegeben,
  veröffentlicht wird erst nach Etappe F). Entschieden in Klick-Runde 6 (Alwin, 16.11.2026):
  - **Nachprüfung:** Neuer Abschnitt „Bedingungen“ in der Karte „Nachprüfung“. Er meldet, was das Formular verhindert
    hätte – eine gesperrte Antwort („„Bereich“: „Gruppenleiter“ gewählt – nur für Getaufte“) oder eine Antwort auf eine
    Frage, die nicht gezeigt worden wäre. Das entsteht nur durch Eintragen von Hand in ChurchTools; geändert wird nichts.
    Jeder Befund zählt als Hinweis, „Anmeldung öffnen“ springt ins Fenster dieser Anmeldung.
  - **„Person dazu“ (von Hand)** startet mit den Kontakt-Antworten der Anmeldung. Fragen der Person, die auf eine
    Kontakt-Frage schauen, erscheinen wie im Formular und werden gespeichert – bis F1e blieben sie unsichtbar und fielen
    beim Speichern weg. Die Kontakt-Felder selbst werden dabei nicht umgerechnet (`anmeldungAufbauen` mit `nurPerson`),
    eine inzwischen geänderte Kontakt-Antwort lässt „Person dazu“ also nicht scheitern.
  - Neu im Regel-Teil: `shared/anmeldung/antwortenAusListe.ts` – der Rückweg aus ChurchTools in die Antworten des
    Formulars (`antwortenAus`, Spiegel von `ctWert`, gelesen über `antwortText`) und `bedingungsBefunde`, gebaut auf
    `ungueltigeAntworten` (dieselbe Prüfung wie im Formular).
  - Demo (`?demo`, nur zum Entwickeln): Die Lobpreisfreizeit hat jetzt zwei echte Anmeldungen mit Antworten, Personen
    und Personensuche – Familie Beispiel verstößt gegen zwei Bedingungen (Nachprüfung), Tom Muster ist „im Team“
    („Person dazu“ zeigt die Fragen fürs Team).
  - Der Stichtag einer Veranstaltung (fürs Alter) steht in der Veranstaltungsseite an einer Stelle (`stichtagVon`).
  - Anzeige in Tabelle, Druckliste und „Anmeldung ansehen“: nichts zu tun – leere Antworten stehen dort schon als „–“
    bzw. leer, „fehlt“ gibt es nicht.
