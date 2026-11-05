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

**Das brauchst du:** Ein iPhone (Safari) mit Recht an der Erweiterung und einen Laptop, auf dem jemand aus der Technik
die Gebetsabend-Seite offen hat (TF-GEBET-03).

**Das muss passieren:** Ohne Übertragung ist der Knopf aus und geht von selbst an, sobald gestartet ist. Ein Tippen
bringt Bild und Ton; gesperrt läuft der Ton weiter. Wird neu gestartet, verbindet sich der Player selbst neu; wird
beendet, schließt er sich mit „Die Übertragung ist beendet“.

1. Am iPhone im Menü auf **Gebetsabend**: Karte „Noch keine Übertragung“, Knopf grau.
2. Am Laptop **Übertragung starten**: Nach höchstens 20 Sekunden steht „Läuft seit … Uhr“, der Knopf ist blau.
3. **Gebetsabend zuhören** tippen: Bild und Ton kommen; unter dem Bild „Der Ton kommt an.“. Bleibt das Bild schwarz,
   zeigt es einen Wiedergabe-Knopf; ein Tippen ins Bild startet es (Hinweis darunter).
4. iPhone sperren, 30 Sekunden warten, entsperren: Ton lief weiter, Bild läuft.
5. Am Laptop **Sender neu starten**: Der Player zeigt kurz „Kurz unterbrochen …“ und spielt danach von selbst weiter.
6. Ins Bild tippen: Apples Leiste erscheint. **Vollbild** (zwei Pfeile) → das Bild füllt den ganzen Bildschirm, auch
   quer und auch in der ChurchTools-App vom Home-Bildschirm; X → zurück, Ton läuft weiter. In **Safari** (nicht in der
   App vom Home-Bildschirm) gibt es dort auch **Bild-in-Bild**.
7. Am Laptop **Übertragung beenden**: Nach höchstens 20 Sekunden ist der Player weg, „Die Übertragung ist beendet“.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `gebetsabend/src/Zuhoeren.tsx`, `gebetsabend/src/Zuhoeren.module.scss`, `gebetsabend/src/lesen.ts`, `shared/gebetsabend/zuhoeren.ts`, `shared/gebetsabend/zustand.ts`, `shared/gebetsabend/links.ts`
- **Automatisiert:** teilweise – `gebetsabend/src/Zuhoeren.test.tsx` (Nachfragen mit Fake-Timern, Herkunft, Neustart, Ende, vorübergehender Fehler, Apple-Leiste und Erlaubnisse des Players), `shared/gebetsabend/zuhoeren.test.ts`, `shared/gebetsabend/zustand.test.ts`; Bild, Ton, Sperren, Vollbild und Bild-in-Bild nur am Gerät
- **Historie:** neu mit G2 (05.11.2026); Grundlage Messung S0/S0b/G0; seit G3 startet und beendet die Technik in der Seite

</details>

### TF-GEBET-03 · Technik: starten, Sender in der Seite, neu geladen, beenden, Einstellungen

**Das brauchst du:** Einen Laptop (Chrome) mit einem Konto der Technik (darf „Gebetsabend: Zugang“ und
„Gebetsabend: Einstellungen“ bearbeiten), ein zweites Gerät zum Zuhören und eine Person ohne diese Rechte (z. B. über
„Person simulieren“).

**Das muss passieren:** Die Technik sieht die Karte „Übertragung“. „Übertragung starten“ setzt neue Zugangsdaten und
startet den Sender in der Seite; erst danach meldet die Seite „läuft“. Auf dem Sender-Gerät gibt es kein Zuhören. Nach
dem Neuladen startet der Sender nicht von selbst, „Sender hier starten“ nimmt dieselben Daten. Beenden fragt nach und
trennt alle. Unter dem Zahnrad lassen sich Kalender und Suchwort ändern; der Termin folgt sofort. Wer nicht zur
Technik gehört, sieht nichts davon.

1. Als Technik auf **Gebetsabend**: Karte „Übertragung · nur Technik“, „Nicht gestartet“, „Bild + Ton“ gewählt.
2. **Übertragung starten**: Der Browser fragt nach Kamera und Mikrofon (beim ersten Mal) – erlauben. Das Kamerabild
   steht in der Karte, darüber „Läuft seit … Uhr · Sender auf diesem Gerät“. Unten statt „Gebetsabend zuhören“ der
   Hinweis, ein anderes Gerät zu nehmen.
3. Am zweiten Gerät zuhören: Bild und Ton kommen (TF-GEBET-02, Schritt 3).
4. Am Laptop die Seite neu laden: „Läuft – der Sender ist auf diesem Gerät nicht aktiv“, kein Kamerabild. Das zweite
   Gerät zeigt „Kurz unterbrochen …“. **Sender hier starten**: Kamerabild wieder da, das zweite Gerät spielt weiter.
5. **Sender neu starten**: Das Kamerabild lädt neu, das zweite Gerät verbindet sich von selbst wieder.
6. **Übertragung beenden** → Rückfrage → **Beenden**: „Nicht gestartet“; am zweiten Gerät nach höchstens 20 Sekunden
   „Die Übertragung ist beendet“.
7. Noch einmal starten: Am zweiten Gerät öffnet „Gebetsabend zuhören“ die neue Übertragung (neue Zugangsdaten).
8. **Zahnrad**: Kalender und Wort ändern, **Speichern** – der Termin auf der Seite wechselt sofort. Fenster neu öffnen:
   der gespeicherte Stand steht da.
9. „Nur Ton“ wählen und starten: VDO.Ninja zeigt im Sender eine Geräteauswahl – Mikrofon bestätigen; am zweiten Gerät
   kommt nur Ton. Danach beenden.
10. Die Person ohne Rechte simulieren: keine Karte „Übertragung“, kein Zahnrad. Simulation beenden.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `gebetsabend/src/Technik.tsx`, `gebetsabend/src/Technik.module.scss`, `gebetsabend/src/EinstellungenFenster.tsx`, `gebetsabend/src/App.tsx`, `gebetsabend/src/speicher.ts`, `gebetsabend/src/start.ts`, `shared/gebetsabend/technik.ts`, `shared/gebetsabend/ablage.ts`
- **Automatisiert:** teilweise – `gebetsabend/src/Technik.test.tsx` (Starten erst nach Speichern, Konflikt, vorübergehender Fehler, nie von selbst „hier“, neu starten, beenden mit Rückfrage, fremder Neustart stoppt den Sender, mit Fake-Timern), `gebetsabend/src/EinstellungenFenster.test.tsx`, `gebetsabend/src/Zuhoeren.test.tsx` (kein Zuhören auf dem Sender-Gerät), `shared/gebetsabend/ablage.test.ts`, `shared/gebetsabend/technik.test.ts`; Kamera, Mikrofon und echte Übertragung nur in der Test-Instanz
- **Historie:** neu mit G3 (05.11.2026); Entwurf v3 (`gebetsabend-planung/entwurf/gebetsabend-v3.html`)

</details>
