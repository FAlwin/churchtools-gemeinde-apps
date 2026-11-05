# Gebetsabend

Die Erweiterung „Gebetsabend“ (Kürzel `gebetsabend`, Anleitung `docs/betrieb/GEBETSABEND.md`). Getestet wird in der
**Test-Instanz**, nie in der Live-Instanz der Gemeinde. Das Paket baut `npm run build -w gebetsabend` und
`npm run paket -w gebetsabend`; hochladen unter **Administration → Erweiterungen → Stift beim Modul → ZIP-Datei**.

### TF-GEBET-01 · Einrichten legt beide Kategorien an, ohne Recht gibt es nur den Hinweis

**Das brauchst du:** Die Erweiterung frisch installiert (noch nicht eingerichtet), ein Admin-Konto und eine Person ohne
Recht „Kategorien erstellen“ (z. B. über „Person simulieren“).

**Das muss passieren:** Der Admin sieht „noch nicht eingerichtet“ und einen Knopf **Einrichten**. Danach steht „Der
Gebetsabend ist eingerichtet“, und unter Administration → Berechtigungen stehen bei der Erweiterung die Kategorien
„Gebetsabend: Zugang“ und „Gebetsabend: Einstellungen“ – jede genau einmal. Eine Person ohne das Recht sieht keinen
Knopf, sondern den Hinweis, sich an die Verwaltung zu wenden.

1. Als Admin im Menü auf **Gebetsabend**: „noch nicht eingerichtet“ und **Einrichten**.
2. **Einrichten** tippen: Der Knopf zeigt „Wird eingerichtet …“, danach „Der Gebetsabend ist eingerichtet“.
3. Die Seite neu laden: weiterhin „eingerichtet“, kein Knopf.
4. Unter **Administration → Berechtigungen** bei „Gebetsabend“: beide Kategorien, keine doppelt.
5. Eine Person ohne Recht simulieren und die Seite öffnen: kein Knopf, nur der Hinweis. Simulation beenden.
6. Unten auf der Seite steht die Version des hochgeladenen Pakets.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `gebetsabend/src/Einrichtung.tsx`, `gebetsabend/src/einrichten.ts`, `gebetsabend/src/start.ts`, `shared/gebetsabend/einrichten.ts`
- **Automatisiert:** teilweise – `shared/gebetsabend/einrichten.test.ts`, `gebetsabend/src/start.test.ts` (Regeln und Laden); das echte Anlegen und die Rechte-Seite von ChurchTools nur in der Test-Instanz
- **Historie:** neu mit G1 (05.11.2026)

</details>
