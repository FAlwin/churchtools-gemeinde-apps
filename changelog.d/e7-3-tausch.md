### Neu (Dienstplaner)

- **Dienste tauschen** (Bauplan E7-3, Entwurf `e7-3-tausch.html`, Alwin 04.11.2026): An jedem eigenen Dienst – zugesagt
  oder noch offen – steht „Tauschen“ (Startseite „Deine nächsten Dienste“ und „Für dich offen“, Dienste → Meine, in der
  Termin-Ansicht unter dem eigenen Platz). Ein Fenster zeigt alle, die denselben Dienst an einem anderen Termin haben;
  ein Tipp schickt die Tausch-Anfrage. Getauscht wird erst, wenn die andere Person annimmt – dann sind beide zugesagt.
- **Tausch-Anfragen an mich** stehen in „Für dich offen“: „A möchte tauschen: Du bekämst … am … und gibst deinen am …
  ab.“ mit Annehmen (ohne Rückfrage, ein Tausch lässt sich nicht rückgängig machen) und Ablehnen.
- **Eigene Anfragen am Dienst:** „Tausch angefragt bei … “ mit Zurückziehen; abgelehnt mit „Andere fragen“. Je Dienst
  eine Anfrage auf einmal.

### Intern (Dienstplaner)

- Kern `shared/dienstplan/tausch.ts` (gemessen als Spike, `messung-e7.md`): Die ID der eigenen Einteilung ändert sich
  bei jeder Antwort – sie wird vor jedem Schreiben frisch gelesen; nach jedem Schreiben wird nachgelesen (Annehmen
  zählt erst, wenn der getauschte Dienst wirklich da ist). Den eigenen Ausgang führt ChurchTools nur je Einteilung.
  Nachbau `tausch.testutil.ts` für Kern- und Oberflächen-Tests.
