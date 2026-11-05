# Gebetsabend

Die Erweiterung „Gebetsabend“ (Kürzel `gebetsabend`, Anleitung `docs/betrieb/GEBETSABEND.md`). Getestet wird in der
**Test-Instanz**, nie in der Live-Instanz der Gemeinde. Das Paket baut `npm run build -w gebetsabend` und
`npm run paket -w gebetsabend`; hochladen unter **Administration → Erweiterungen → Stift beim Modul → ZIP-Datei**.

### TF-GEBET-01 · Einrichten legt beide Kategorien an, ohne Recht gibt es nur den Hinweis

**Das brauchst du:** Die Erweiterung frisch installiert (noch nicht eingerichtet), ein Admin-Konto und eine Person ohne
Recht „Kategorien erstellen“ (z. B. über „Person simulieren“).

**Das muss passieren:** Der Admin sieht „noch nicht eingerichtet“ und einen Knopf **Einrichten**. Danach steht die Karte
„Noch keine Übertragung“ mit dem (ausgegrauten) Knopf „Gebetsabend zuhören“, und unter Administration → Berechtigungen stehen bei der Erweiterung die Kategorien
„Gebetsabend: Zugang“ und „Gebetsabend: Einstellungen“ – jede genau einmal. Eine Person ohne das Recht sieht keinen
Knopf, sondern den Hinweis, sich an die Verwaltung zu wenden.

1. Als Admin im Menü auf **Gebetsabend**: „noch nicht eingerichtet“ und **Einrichten**.
2. **Einrichten** tippen: Der Knopf zeigt „Wird eingerichtet …“, danach „Noch keine Übertragung“.
3. Die Seite neu laden: weiterhin „Noch keine Übertragung“, kein Knopf „Einrichten“.
4. Unter **Administration → Berechtigungen** bei „Gebetsabend“: beide Kategorien, keine doppelt.
5. Eine Person ohne Recht simulieren und die Seite öffnen: kein Knopf, nur der Hinweis. Simulation beenden.
6. Unten auf der Seite steht die Version des hochgeladenen Pakets.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `gebetsabend/src/Einrichtung.tsx`, `gebetsabend/src/einrichten.ts`, `gebetsabend/src/start.ts`, `shared/gebetsabend/einrichten.ts`
- **Automatisiert:** teilweise – `shared/gebetsabend/einrichten.test.ts`, `gebetsabend/src/start.test.ts` (Regeln und Laden); das echte Anlegen und die Rechte-Seite von ChurchTools nur in der Test-Instanz
- **Historie:** neu mit G1 (05.11.2026)

</details>

### TF-GEBET-02 · Zuhören am iPhone: ein Tippen, gesperrt weiter, Neustart und Ende kommen von selbst

**Das brauchst du:** Ein iPhone (Safari) mit Recht an der Erweiterung, einen Laptop als Sender und die Zugangsdaten
einer laufenden Übertragung in der Kategorie „Zugang“ (bis G3 da ist: von Hand eingetragen, siehe Bauplan).

**Das muss passieren:** Ohne Übertragung ist der Knopf aus und geht von selbst an, sobald gestartet ist. Ein Tippen
bringt Bild und Ton; gesperrt läuft der Ton weiter. Wird neu gestartet, verbindet sich der Player selbst neu; wird
beendet, schließt er sich mit „Die Übertragung ist beendet“.

1. Am iPhone im Menü auf **Gebetsabend**: Karte „Noch keine Übertragung“, Knopf grau.
2. Übertragung starten (Laptop): Nach höchstens 20 Sekunden steht „Läuft seit … Uhr“, der Knopf ist blau.
3. **Gebetsabend zuhören** tippen: Bild und Ton kommen; unter dem Bild „Der Ton kommt an.“. Bleibt das Bild schwarz,
   zeigt es einen Wiedergabe-Knopf; ein Tippen ins Bild startet es (Hinweis darunter).
4. iPhone sperren, 30 Sekunden warten, entsperren: Ton lief weiter, Bild läuft.
5. Neu starten (neue Zugangsdaten): Nach höchstens 20 Sekunden lädt der Player neu und spielt wieder.
6. Beenden: Nach höchstens 20 Sekunden ist der Player weg, „Die Übertragung ist beendet“.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `gebetsabend/src/Zuhoeren.tsx`, `gebetsabend/src/lesen.ts`, `shared/gebetsabend/zuhoeren.ts`, `shared/gebetsabend/zustand.ts`, `shared/gebetsabend/links.ts`
- **Automatisiert:** teilweise – `gebetsabend/src/Zuhoeren.test.tsx` (Nachfragen mit Fake-Timern, Herkunft, Neustart, Ende, vorübergehender Fehler), `shared/gebetsabend/zuhoeren.test.ts`, `shared/gebetsabend/zustand.test.ts`; Bild, Ton und Sperren nur am Gerät
- **Historie:** neu mit G2 (05.11.2026); Grundlage Messung S0/S0b/G0

</details>
