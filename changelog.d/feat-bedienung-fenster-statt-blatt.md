### Geändert (alle Apps)

- **Fenster statt Blatt von unten.** Am Handy öffnen „⋯“, die Ansichtswahl („Matrix ⌄“, „Termine ⌄“, „Kommende ⌄“ …) und das schwebende Plus mit mehreren Möglichkeiten („Neu“ in den Protokollen, Eintrag hinzufügen im Ablauf) ihre Auswahl jetzt als **Fenster in der Mitte** – mit Titel, ✕ und den Einträgen als Liste, wie jedes andere Fenster. Das Blatt mit dem Griff unten ist weg; ✕, Escape und ein Tipp daneben schließen. Am iPad und Rechner bleiben es die kleinen Menüs am Knopf.
- **Gewohnheit: Das Fenster liegt immer ganz oben.** Vorher lag in „Wann kann ich?“ das grüne Plus über dem offenen Fenster „Zeitraum eintragen“. Jetzt liegt jedes Fenster und jede Rückfrage über dem Plus, der Reiterleiste und Leisten wie „3 Entwürfe … Ansehen & senden“ – in allen Apps.

### Intern

- Ursache des Plus über dem Fenster: `Sheet` und `ConfirmDialog` hingen im Inhalt der Seite. Ein Kasten darüber mit eigenem Stapel (in „Wann kann ich?“ die klebende Leiste mit `position: sticky; z-index: 2`) sperrte das Fenster mit seinen 100 dort ein; das Plus (Ebene 3) lag darüber. Jetzt zeichnen sich beide über den neuen Baustein `FensterEbene` (`ui/fenster`) als Kind direkt unter `#root`; die Ebenen stehen als `--ebene-fenster` (2600), `--ebene-bestaetigung` (2700) und `--ebene-hinweis` (2800, `Toast`) in `_variables.scss`. Wächter: `ebeneFenster.test.ts` (Ebenen geordnet, kein zweites Fenster-Gerüst), `FensterEbene.test.tsx`.
- `AuswahlBlatt` heißt `AuswahlFenster` und ist ein `Sheet` (`knoepfe={null}`); `MehrMenue`, `AnsichtWahl`, `HinzufuegenMenue` und `useAblaufBearbeiten` rufen es auf. Fenster liegen im DOM nicht mehr im Inhalt der Seite: Tests suchen den Schleier über `getByRole('dialog').parentElement`, nicht über `container`.
