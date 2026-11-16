### Neu (Protokolle, S6-3b)

- **Protokoll als PDF teilen** (Entwurf `s6-freigabe-pdf-v1`, Alwin 09./11.11.2026): Oben in jeder Sitzung mit
  Protokoll – beim Lesen und beim Schreiben, für alle, die es lesen dürfen – gibt es **„Teilen / PDF“**. Das Fenster
  „Protokoll teilen“ zeigt die Seiten, dazu „Herunterladen“ und „Teilen“ wie im Dienstplaner. Das PDF hat Kopf mit
  Freigabe-Vermerk, das Protokoll wie beim Lesen und am Ende die Übersicht (Beschlüsse, To-Dos, Termine, nächste
  Sitzung). Ein **Entwurf** trägt „ENTWURF – NOCH NICHT FREIGEGEBEN“ im Kasten, ein blasses „ENTWURF“ auf jeder Seite
  und „ENTWURF“ im Dateinamen. Im Editor kommt auch noch nicht Gespeichertes mit.

### Intern (S6-3b)

- Fenster `protokolle/src/ProtokollTeilenFenster.tsx` auf den gemeinsamen Bausteinen (`PdfKnoepfe`,
  `PdfStandUndVorschau`, `useGebautesPdf`), nachgeladen über `ProtokollTeilen.tsx` (jsPDF und pdf.js erst beim
  Antippen). Anwesenheit und – außerhalb des Editors – Mitglieder werden frisch gelesen; scheitert eins, entsteht das
  PDF trotzdem (Hinweis im PDF, Grund im Log).
- Auf dem Blatt werden Zuständige, die man nicht kennt (Mitgliederliste verborgen), wie in der To-Do-Liste gezählt
  („eine weitere Person“) statt weggelassen – sonst stand „noch niemand“, obwohl jemand zuständig ist.
