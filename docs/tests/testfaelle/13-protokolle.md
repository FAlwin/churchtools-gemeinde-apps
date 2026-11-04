# Protokolle

Die Erweiterung „Protokolle“ (Kürzel `protokolle`, Anleitung `docs/betrieb/PROTOKOLLE.md`). Getestet wird in der
**Test-Instanz**, nie in der Live-Instanz der Gemeinde, und nur mit eigenen Test-To-Dos (Text beginnt mit „TEST“). Das
Paket baut `npm run build -w protokolle` und `npm run paket -w protokolle`; hochladen unter **Administration →
Erweiterungen → Stift beim Modul → ZIP-Datei**.

### TF-PROT-01 · To-Do im Board mit dem Finger ziehen

**Das brauchst du:** Ein iPhone oder iPad, in der Test-Instanz eine Gruppe mit Protokollen und darin zwei eigene
Test-To-Dos (z. B. „TEST Ziehen A“ und „TEST Ziehen B“, beide „Offen“).

**Das muss passieren:** Ein kurzes Wischen über die Karten blättert nur die Seite – keine Karte geht mit. Erst wenn der
Finger etwa eine halbe Sekunde liegt, hebt sich die Karte an. Das Bild unter dem Finger ist **genauso breit wie die
Karte**, der Text darin bricht nicht anders um. Nach dem Loslassen in einer anderen Spalte steht das To-Do dort, auch
nach dem Neuladen.

1. In ChurchTools im Menü auf **Protokolle**, unten auf **To-Dos**.
2. Oben **Board** und **Nach Status** wählen.
3. Mit dem Finger schnell über die Karten in „Offen“ wischen: Die Seite blättert, keine Karte bewegt sich.
4. Auf „TEST Ziehen A“ den Finger legen und liegen lassen, bis die Karte sich anhebt.
5. In die Spalte **In Arbeit** ziehen und loslassen: Die Karte steht dort, ihre Status-Marke zeigt „In Arbeit“.
6. Die Seite neu laden: „TEST Ziehen A“ steht weiter in „In Arbeit“.
7. Oben **Sortieren → Manuell** wählen und in „Offen“ „TEST Ziehen B“ über eine andere Karte ziehen: Die Reihenfolge
   ändert sich und bleibt nach dem Neuladen.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `protokolle/src/ToDoZiehen.tsx`, `protokolle/src/toDoZiehenRegel.ts`, `protokolle/src/ToDos.tsx`, `protokolle/src/ToDos.module.scss`, `ui/bedienung/useZiehSensoren.ts`
- **Automatisiert:** teilweise – `protokolle/src/toDoZiehenRegel.test.ts`, `protokolle/src/ToDoZiehen.test.tsx`, `protokolle/src/ToDos.board.test.tsx`, `ui/bedienung/useZiehSensoren.test.ts` (Regeln und Sensoren); das echte Liegenlassen des Fingers und die Breite des Zieh-Bilds nur am Gerät
- **Historie:** #811 (30.10.2026: Zieh-Bild am iPhone breiter als die Karte; ein To-Do mit zwei Zuständigen verlor beim Umordnen eine Person)

</details>

### TF-PROT-02 · Die Einstellungen der To-Do-Seite kommen auf dem zweiten Gerät an

**Das brauchst du:** Zwei Geräte mit demselben ChurchTools-Konto (z. B. iPhone und iPad oder Laptop).

**Das muss passieren:** Was man auf dem einen Gerät einstellt – Liste oder Board, Nach Status oder Nach Person,
Sortieren, Filter, die eigene Reihenfolge –, steht nach kurzer Zeit auch auf dem anderen Gerät so da. Ohne Netz bleibt
die Einstellung auf dem Gerät und geht mit, sobald das Netz wieder da ist.

1. Auf Gerät 1 im Menü auf **Protokolle**, unten auf **To-Dos**.
2. Oben **Board**, **Nach Person** und **Sortieren → Alphabetisch** wählen.
3. Ein paar Sekunden warten.
4. Auf Gerät 2 die To-Dos öffnen (bzw. neu laden): Board, Nach Person und Alphabetisch sind eingestellt.
5. Auf Gerät 2 zurück auf **Liste** stellen, auf Gerät 1 neu laden: Gerät 1 zeigt die Liste.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `protokolle/src/useToDoEinstellungen.ts`, `protokolle/src/todoEinstellungen.ts`, `shared/ct/personenAblage.ts`, `ui/ct/ablagePort.ts`
- **Automatisiert:** teilweise – `protokolle/src/useToDoEinstellungen.test.ts` (wann abgeglichen wird, nichts geht verloren), `shared/ct/personenAblage.daten.test.ts` (Zusammenführen, Ersetzen); das Zusammenspiel zweier echter Geräte nur von Hand
- **Historie:** #811 (S7-3, 30.10.2026)

</details>

### TF-PROT-03 · Geteiltes Gerät: die zweite Person bekommt nicht die Einstellungen der ersten

**Das brauchst du:** Ein Gerät und zwei Personen. In der Test-Instanz geht „Person simulieren“ (nur mit der Testperson,
nie mit echten Gemeindegliedern).

**Das muss passieren:** Die zweite Person sieht die To-Do-Seite in **ihrer** Einstellung (beim ersten Mal: Liste, nach
Status) – nicht in der der ersten. An ihrem Konto entsteht dabei keine Einstellungs-Datei mit den Werten der ersten
Person.

1. Als Person A die To-Dos öffnen und **Board** und **Nach Person** wählen, ein paar Sekunden warten.
2. Als Person B anmelden (oder B simulieren), im Menü auf **Protokolle**, unten auf **To-Dos**.
3. B sieht ihre eigene Einstellung, nicht Board/Nach Person von A.
4. Zurück als A: Board und Nach Person sind wieder da.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `protokolle/src/useToDoEinstellungen.ts`
- **Automatisiert:** ja – `protokolle/src/useToDoEinstellungen.test.ts` („je Person …“, „Übernahme aus S7-1 einmal“); von Hand bleibt der echte Personenwechsel in ChurchTools
- **Historie:** #811 (30.10.2026: Spiegel im Gerät war je Browser statt je Person – B bekam As Einstellungen, auch in seine Datei); dieselbe Lücke in der Musik-App: TF-AUTH-09, #813

</details>

### TF-PROT-04 · Werkzeugleiste am iPhone: Farbe und Textart treffen den markierten Text

**Das brauchst du:** Ein iPhone, in der Test-Instanz ein eigenes Test-Protokoll im Entwurf (Titel beginnt mit „TEST“).

**Das muss passieren:** Die Leiste zeigt vorn Rückgängig, Wiederholen, **B** und **Aa**, dahinter drei Zeichen mit
Pfeil (Stift, Zeilen, Plus) – nichts ragt rechts hinaus. Ein Menü klappt unter seinem Zeichen auf und passt auf den
Bildschirm. Tippt man darin eine Farbe oder Textart, wirkt sie **auf den vorher markierten Text** – die Markierung geht
beim Tippen ins Menü nicht verloren.

1. In ChurchTools im Menü auf **Protokolle**, das Test-Protokoll öffnen (Schreiben).
2. Ins Blatt doppeltippen, um zu schreiben: Die Seite **zoomt nicht** hinein. Danach in einer Zeile ein Wort markieren
   (lange drücken, Griffe ziehen).
3. Auf den **Stift** tippen: Das Menü zeigt „Hintergrund“ und „Schrift“ mit je zehn Feldern.
4. Unter „Hintergrund“ **Grün** tippen: Das Menü geht zu, das Wort ist grün hinterlegt.
5. Das Wort wieder markieren, Stift, unter „Schrift“ **Rot**: Das Wort ist rot.
6. In eine leere Zeile tippen, **Aa → Unterpunkt**: Die Zeile ist eine kleine Überschrift.
7. **Plus → Tabelle**: Eine Tabelle mit drei Spalten und fett gesetzter Kopfzeile erscheint.
8. **Plus → Termin**, ein Datum wählen und einen langen Text tippen (auch ein langes Wort ohne Leerzeichen): Das Datum
   steht links, der Text bricht **daneben** im blauen Kasten um – keine Buchstabensäule rechts, die Seite lässt sich
   nicht seitlich schieben.
9. Oben **Lesen**: Grün, Rot, die Tabelle und der Termin sehen aus wie im Editor.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `protokolle/src/Werkzeugleiste.tsx`, `protokolle/src/Werkzeugleiste.module.scss`, `protokolle/src/farben.ts`, `protokolle/src/tabelleEinfuegen.ts`, `protokolle/src/ProtokollAnsicht.tsx`, `protokolle/src/EditorBloecke.module.scss`, `protokolle/src/ProtokollAnsicht.module.scss`, `ui/fenster/tippZoom.ts`
- **Automatisiert:** teilweise – `protokolle/src/Werkzeugleiste.test.tsx` (Menüs, Farben, Tabelle, Handy-Aufbau mit echtem Editor), `protokolle/src/editorSchema.test.tsx`, `protokolle/src/farben.test.ts`, `ui/fenster/tippZoom.test.ts`; ob die Markierung beim Tippen am iPhone erhalten bleibt und wie der Termin umbricht, nur am Gerät
- **Historie:** K3a (04.11.2026: Leiste in Gruppen, Variante B; am iPhone gefunden: Termin-Text 0 px breit als Buchstabensäule neben dem Kasten – die Handy-Regel der To-Do-Schildchen galt für alle Schildchen, seit S4-2; Safari zoomte beim Antippen leicht hinein – Schrift unter 16 px, jetzt `maximum-scale=1` auf iOS in allen Apps)

</details>
