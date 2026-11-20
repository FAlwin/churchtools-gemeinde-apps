# Website

Die Erweiterung „Website“ (Kürzel `website`, Anleitung `docs/betrieb/WEBSITE.md`). Getestet wird in der **Test-Instanz**,
nie in der Live-Instanz der Gemeinde. Das Paket baut `npm run build -w website` und `npm run paket -w website`; hochladen unter
**Administration → Erweiterungen → Stift beim Modul → ZIP-Datei** (neues Modul: Kürzel genau `website`).

### TF-WEBSITE-01 · Einrichten legt beide Kategorien für die gewählte Gruppe an, ohne Admin gibt es nur den Hinweis

**Das brauchst du:** Die Erweiterung frisch installiert (noch nicht eingerichtet), ein Admin-Konto, in ChurchTools eine Gruppe
„Website“ und eine Person ohne Admin-Recht (z. B. über „Person simulieren“).

**Das muss passieren:** Der Admin sieht „Website einrichten“ mit der vorgewählten Gruppe „Website“ und dem Knopf
**Einrichten**. Danach steht der Hinweis „Diese Website hat noch keine Startseite“, und unter Administration → Berechtigungen
stehen bei der Erweiterung die Kategorien „Website: Entwürfe · Website“ und „Website: Veröffentlicht · Website“ – jede genau
einmal. Eine Person ohne Admin-Recht sieht keinen Einrichten-Knopf, sondern einen Hinweis.

1. Als Admin im Menü auf **Website**: „Website einrichten“, die Gruppe „Website“ ist gewählt.
2. **Einrichten** tippen: „Wird eingerichtet …“, danach der Rahmen mit den Reitern Seiten · Aussehen · Freigaben.
3. Die Seite neu laden: kein „Einrichten“ mehr.
4. Unter **Administration → Berechtigungen** bei „Website“: beide Kategorien, keine doppelt.
5. Eine Person ohne Admin-Recht simulieren und die Seite öffnen: Hinweis, kein Knopf. Simulation beenden.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `website/src/Einrichtung.tsx`, `website/src/einrichten.ts`, `website/src/start.ts`, `shared/website/einrichten.ts`
- **Automatisiert:** teilweise – `website/src/Einrichtung.test.tsx`, `website/src/start.test.ts`, `shared/website/einrichten.test.ts` (Regeln, Laden, Auswahl); das echte Anlegen und die Rechte-Seite von ChurchTools nur in der Test-Instanz
- **Historie:** neu mit W3a-1 (20.11.2026); angepasst an die gemessene Content-Security-Policy mit W3a-2b (20.11.2026)

</details>

### TF-WEBSITE-02 · Zugang: nur Admins und die Leitung der Gruppe – Mitarbeiter bekommen einen Hinweis

**Das brauchst du:** Eingerichtete Website, die Gruppe „Website“ mit einer Leitung und einem Mitarbeiter, dazu die Rechte an
„Entwürfe“ für die Leiter-Rolle (siehe Anleitung, „Wer darf was“). Zum Probieren „Person simulieren“.

**Das muss passieren:** Admin und Leitung sehen den Rahmen mit den Reitern und die Seitenliste. Der Mitarbeiter (und jede andere
Person) sieht nur: „Die Website bearbeiten dürfen die Admins und die Leitung der Gruppe ‚Website‘.“ – keinen Editor. Hat die
Leitung die Rechte an den Kategorien noch nicht, steht „noch nicht eingerichtet, oder dir fehlt das Recht“.

1. Als Admin die Erweiterung öffnen: Reiter und Seitenliste.
2. Als **Leiter** der Gruppe simulieren: dasselbe.
3. Als **Mitarbeiter** der Gruppe simulieren: nur der Hinweis.
4. Als Person ohne Verbindung zur Gruppe simulieren: Hinweis („dir fehlt das Recht“ bzw. wer es darf).

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `website/src/App.tsx`, `website/src/start.ts`, `shared/website/zugang.ts`
- **Automatisiert:** teilweise – `website/src/App.test.tsx`, `website/src/start.test.ts`, `shared/website/zugang.test.ts`; das echte Verhalten von Gruppenrollen und Kategorie-Rechten nur in der Test-Instanz
- **Historie:** neu mit W3a-1 (20.11.2026); angepasst an die gemessene Content-Security-Policy mit W3a-2b (20.11.2026)

</details>

### TF-WEBSITE-03 · Startseite anlegen, neue Seite, Seite löschen – und die Vorschau

**Das brauchst du:** Die eingerichtete Website (Admin oder Leitung), noch ohne Seite.

**Das muss passieren:** Ohne Seite steht der Hinweis mit dem Knopf **Startseite anlegen** – nichts wird von selbst angelegt. Der
Knopf legt eine Startseite aus der Vorlage an; die Vorschau zeigt sie (Schriftzug), der Umschalter wechselt zwischen **Computer**
und **Handy** (schmaler Rahmen). **Neue Seite** nimmt einen Titel, zeigt die Adresse darunter und legt eine leere Seite an. **Seite
löschen** fragt erst nach. Nach dem Neuladen der Seite steht alles unverändert da.

1. Die Erweiterung öffnen: „Diese Website hat noch keine Startseite“. **Startseite anlegen**.
2. Die Vorschau zeigt die Startseite; **Handy** tippen, dann **Computer**.
3. **Neue Seite**, Titel „Über uns“: darunter steht die Adresse `/ueber-uns/`; **Anlegen**. Die Seite steht unter „Weitere Seiten“.
4. Noch eine Seite „Über uns“ anlegen: ihre Adresse ist `/ueber-uns-2/`.
5. Die zweite Seite wählen, **Seite löschen**, erst **Abbrechen** (nichts passiert), dann noch einmal und **Löschen**.
6. Die Seite neu laden: die Startseite und „Über uns“ stehen da, die gelöschte nicht.
7. In ChurchTools unter _Administration → Erweiterungen → Website_ in der Kategorie „Entwürfe“: je Seite ein Kopf-Wert und ein oder mehrere Teil-Werte.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `website/src/Seiten.tsx`, `website/src/NeueSeite.tsx`, `website/src/Vorschau.tsx`, `shared/website/speicher.ts`, `shared/website/seitenListe.ts`
- **Automatisiert:** teilweise – `website/src/Seiten.test.tsx`, `shared/website/speicher.test.ts`, `shared/website/seitenListe.test.ts`; das echte Speichern in ChurchTools nur in der Test-Instanz
- **Historie:** neu mit W3a-1 (20.11.2026); angepasst an die gemessene Content-Security-Policy mit W3a-2b (20.11.2026)

</details>

### TF-WEBSITE-04 · Die Vorschau ist abgeschottet und lädt nichts nach

**Das brauchst du:** Eine Website mit Startseite (Test-Instanz), die Entwicklerwerkzeuge des Browsers.

**Das muss passieren:** Das Vorschau-Fenster ist ein `iframe` mit `sandbox="allow-scripts"` (kein `allow-same-origin`). Die Vorschau
sieht gestaltet aus (Stylesheet greift als `<style>`), Bilder sind graue Platzhalter, es werden keine Schriftdateien und keine
Bilder von ChurchTools geladen. Beim Bearbeiten erscheinen in ChurchTools die Leisten über den Abschnitten (die Ebene läuft mit der
Nonce der Seite).

1. Die Startseite in der Vorschau ansehen: gestaltet, mit grauen Platzhalter-Bildern.
2. In den Entwicklerwerkzeugen das `iframe` prüfen: Attribut `sandbox` ist genau `allow-scripts`.
3. Reiter „Netzwerk“: beim Wechsel zwischen Seiten entstehen keine Anfragen für Schrift- oder Bilddateien.
4. Beim Überfahren eines Abschnitts erscheint die Bearbeiten-Leiste. Erscheint stattdessen nach etwa 2 Sekunden der Hinweis „Bearbeiten
   in der Vorschau ist gerade nicht möglich – ChurchTools hat das Bearbeiten-Skript blockiert“: Seite neu laden; bleibt es, bitte
   melden (Content-Security-Policy, siehe `docs/betrieb/WEBSITE.md`). Skripte im Baustein „Eigenes HTML“ laufen in der Vorschau
   bewusst nicht.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `website/src/Vorschau.tsx`, `website/src/vorschauHtml.ts`, `shared/website/website.css`
- **Automatisiert:** teilweise – `website/src/Vorschau.test.tsx` (Attribut, `srcdoc`, `<style>`, Nonce, Hinweis bei fehlender „bereit“-Meldung), `website/src/ebene.test.ts`, `shared/website/stylesheet.test.ts`; wie ChurchTools das eingebettete Dokument behandelt (CSP) nur in der Test-Instanz
- **Historie:** neu mit W3a-1 (20.11.2026); angepasst an die gemessene Content-Security-Policy mit W3a-2b (20.11.2026)

</details>

### TF-WEBSITE-05 · Abschnitte direkt in der Vorschau einfügen, verschieben, kopieren, löschen

**Das brauchst du:** Die eingerichtete Website (Admin oder Leitung) mit Startseite. Zuerst am Computer, dann am Handy (oder
schmales Fenster).

**Das muss passieren:** Fährt man mit der Maus über einen Abschnitt, erscheint oben rechts seine Leiste (Gestalten · hoch ·
runter · kopieren · löschen), und zwischen den Abschnitten steht **Abschnitt einfügen**. Am Handy genügt ein Tipp auf den
Abschnitt. Jede Aktion steht gleich in der Vorschau und oben steht „Gespeichert“. **Löschen fragt erst nach.** Nach dem Neuladen
der Seite steht alles so da.

1. Die Startseite öffnen, mit der Maus über den ersten Abschnitt fahren: Leiste und „+ Baustein“ erscheinen.
2. **Abschnitt einfügen** unter dem ersten Abschnitt: Fenster mit den Vorlagen als Kacheln. „Drei Spalten“ wählen – er steht
   dort, oben „Speichert … → Gespeichert“.
3. Den neuen Abschnitt mit dem Pfeil **nach oben** vor den ersten schieben, dann **kopieren**: die Kopie steht darunter.
4. **Löschen** tippen: Rückfrage „Abschnitt löschen?“. **Abbrechen** – nichts passiert. Noch einmal, **Löschen** – er ist weg.
5. Auf einer leeren Seite (neue Seite anlegen): in der Vorschau steht „Diese Seite ist noch leer“ mit dem Knopf **Abschnitt
   einfügen**.
6. Die Seite neu laden: alle Änderungen sind noch da.
7. Dasselbe am Handy: tippen statt fahren; die Fenster passen auf den Bildschirm.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `website/src/Seitenarbeit.tsx`, `website/src/Vorschau.tsx`, `website/src/ebene.skript.txt`, `website/src/ebene.css`, `website/src/AbschnittEinfuegen.tsx`, `shared/website/bearbeiten.ts`
- **Automatisiert:** teilweise – `website/src/Seitenarbeit.test.tsx`, `website/src/ebene.test.ts`, `shared/website/bearbeiten.test.ts`; wie sich Fahren/Tippen im echten iframe anfühlt nur von Hand
- **Historie:** neu mit W3a-2 (20.11.2026); 7 + 8 mit W3a-2c (20.11.2026, nach dem Befund „sperrt sich nach dem Neuladen selbst aus“)

</details>

### TF-WEBSITE-06 · Abschnitt gestalten – sofort sichtbar, Abbrechen stellt her, weniger Spalten verliert nichts

**Das brauchst du:** Eine Seite mit einem Abschnitt „Drei Spalten“ (Vorlage), in jeder Spalte Überschrift und Text.

**Das muss passieren:** Jede Einstellung im Fenster „Abschnitt gestalten“ wirkt sofort in der Vorschau. **Abbrechen** (und das X)
stellt den Stand vor dem Öffnen wieder her; erst **Fertig** speichert. Wählt man weniger Spalten, rutschen die Inhalte in die
letzte – es geht nichts verloren. Die Sprungmarke darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten und nicht doppelt
sein; sonst steht die Meldung im Fenster und **Fertig** ist gesperrt.

1. Auf dem Abschnitt **Gestalten**: **Hauptfarbe** und **Breit** wählen – die Vorschau ändert sich sofort. **Abbrechen**: alles wie
   vorher.
2. Noch einmal **Gestalten**, **Eine** Spalte wählen: alle drei Überschriften und Texte stehen nun untereinander in einer Spalte.
   **Fertig**.
3. Wieder öffnen, **1 : 1** wählen: zwei Spalten, die Inhalte liegen in der ersten und in der zweiten (nichts fehlt).
4. **Foto** wählen: ein Platzhalter-Bild mit dem Hinweis, dass eigene Bilder später kommen; **Abdunkeln** regeln.
5. Sprungmarke „Gottesdienst“ eintippen: Meldung (nur Kleinbuchstaben), **Fertig** gesperrt. „gottesdienst“: geht. Bei einem
   zweiten Abschnitt dieselbe Marke: Meldung „hat schon ein anderer Abschnitt“.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `website/src/AbschnittGestalten.tsx`, `website/src/regeln.ts`, `shared/website/bearbeiten.ts`
- **Automatisiert:** `website/src/Seitenarbeit.test.tsx` (sofort sichtbar, Abbrechen, weniger Spalten, Sprungmarke), `shared/website/bearbeiten.test.ts` (jede Aufteilung in jede andere ohne Verlust), `website/src/regeln.test.ts`
- **Historie:** neu mit W3a-2 (20.11.2026); 7 + 8 mit W3a-2c (20.11.2026, nach dem Befund „sperrt sich nach dem Neuladen selbst aus“)

</details>

### TF-WEBSITE-07 · Bausteine bearbeiten, hinzufügen und entfernen – alle 15 Arten

**Das brauchst du:** Eine Seite mit Abschnitten; in der Test-Instanz mindestens ein Kalender.

**Das muss passieren:** Ein Klick auf einen Baustein öffnet sein Fenster mit den passenden Feldern. Änderungen sieht man sofort.
**Entfernen** fragt nach. **+ Baustein** zeigt alle Arten, der neue ist ein Platzhalter und öffnet sich gleich zum Bearbeiten.
„Eigenes HTML“ gibt es nur für Admins und die Leitung. Ungültiges (ein Knopf mit der Adresse `javascript:…`, eine Überschrift ohne
Text) wird nicht gespeichert; die Meldung steht im Fenster.

1. Eine **Überschrift** anklicken: Text, Größe, Rang, Punkt ändern. **Fertig**.
2. Einen **Text** anklicken: ein Wort markieren und **Fett**, **Kursiv**, **Link**, **Liste**, **Zwischenüberschrift** probieren.
3. Einen **Knopf**-Baustein: Ziel „Seite: …“, dann „Andere Adresse …“ mit `javascript:alert(1)` – Meldung, **Fertig** speichert nicht. Mit
   `https://example.org` geht es.
4. **+ Baustein → Termine aus ChurchTools**: die Kalender stehen zur Auswahl; mindestens einen wählen; Anzahl ändern.
5. Nacheinander **Bild, Bild und Text, Galerie, Beiträge, Slider, Livestream, Kontaktformular, Gruppen, Trenner, Handschrift-Zeile**
   hinzufügen: jeder öffnet sich mit seinen Feldern. Bei Bildern steht der Hinweis „Platzhalter-Bild“.
6. **Entfernen** bei einem Baustein: Rückfrage; **Abbrechen** – er bleibt; **Entfernen** – er ist weg.
7. Als Person **ohne** Recht für „Eigenes HTML“ (wird mit W3b möglich): die Kachel fehlt, ein vorhandener Baustein zeigt nur den
   Hinweis.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `website/src/BausteinBearbeiten.tsx`, `website/src/BausteinFelder.tsx`, `website/src/BausteinHinzufuegen.tsx`, `website/src/markdownLeiste.ts`, `shared/website/vorlagen.ts`
- **Automatisiert:** `website/src/BausteinFelder.test.tsx` (je Art, die Liste deckt alle Typen des Modells ab), `website/src/Seitenarbeit.test.tsx`, `website/src/markdownLeiste.test.ts`, `shared/website/vorlagen.test.ts` (`neuerBaustein`); die Kalenderliste aus ChurchTools (ob nur öffentliche kommen) nur in der Test-Instanz
- **Historie:** neu mit W3a-2 (20.11.2026); 7 + 8 mit W3a-2c (20.11.2026, nach dem Befund „sperrt sich nach dem Neuladen selbst aus“)

</details>

### TF-WEBSITE-08 · Seite einstellen – Titel, Adresse, Menü und Reihenfolge

**Das brauchst du:** Eine Website mit Startseite und zwei weiteren Seiten, eine davon im Menü.

**Das muss passieren:** „Seite einstellen“ ändert Titel, Adresse, Beschreibung und die Menü-Zugehörigkeit; die Reihenfolge der
Menüpunkte ändert man mit den Pfeilen. Gespeichert wird erst mit **Fertig**. Eine Adresse, die eine andere Seite schon hat, wird
abgewiesen; die Startseite hat immer „/“. **Seite löschen** steht hier und fragt nach.

1. **Seite einstellen** bei einer Seite: Titel ändern, **Im Menü zeigen** an: sie steht unten in der Reihenfolge.
2. Mit den Pfeilen eine andere Reihenfolge einstellen, **Fertig**: das Menü in der Vorschau hat die neue Reihenfolge, die Liste
   links („Im Menü“) ebenfalls.
3. Bei einer anderen Seite die Adresse einer vorhandenen eintippen: Meldung, **Fertig** gesperrt.
4. Bei der Startseite: Das Feld „Adresse“ zeigt „/“ und ist gesperrt.
5. **Abbrechen** verwirft alle Änderungen im Fenster.
6. **Seite löschen** → Rückfrage → löschen; steht die Seite im Menü, geht der Punkt mit.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `website/src/SeiteEinstellen.tsx`, `website/src/Seiten.tsx`, `shared/website/bearbeiten.ts`, `shared/website/seitenListe.ts`
- **Automatisiert:** `website/src/Seitenarbeit.test.tsx`, `website/src/Seiten.test.tsx`, `shared/website/bearbeiten.test.ts` (Menü)
- **Historie:** neu mit W3a-2 (20.11.2026); 7 + 8 mit W3a-2c (20.11.2026, nach dem Befund „sperrt sich nach dem Neuladen selbst aus“)

</details>

### TF-WEBSITE-09 · Speichern: Zustand, vorübergehender Fehler, Sperre bei gleichzeitigem Bearbeiten

**Das brauchst du:** Die Website in der Test-Instanz, zwei Konten (A und B, beide Admin oder Leitung) in zwei Browsern; für den
Fehlerfall den Browser für kurze Zeit „offline“ stellen (Entwicklerwerkzeuge → Netzwerk).

**Das muss passieren:** Oben steht immer „Speichert … / Gespeichert / Nicht gespeichert“. Fällt das Netz aus, steht „Nicht
gespeichert“ mit **Erneut versuchen**; die Änderung bleibt in der Vorschau, die Seite lässt sich nicht verlassen, bevor sie
gespeichert ist. Bearbeitet A eine Seite, sieht B dort „Gerade bearbeitet von A“ und kann sie nur ansehen. Nach zehn Minuten ohne
Lebenszeichen oder wenn A die Seite verlässt, geht es für B.

1. A ändert etwas (z. B. Abschnitt kopieren): „Speichert …“, dann „Gespeichert“.
2. Netz aus, noch eine Änderung: „Nicht gespeichert“, Hinweis, **Erneut versuchen**; die Vorschau zeigt die Änderung weiter; „Neue
   Seite“ und der Seitenwechsel sind gesperrt. Netz an, **Erneut versuchen**: „Gespeichert“.
3. B öffnet dieselbe Seite: Hinweis „Gerade bearbeitet von A“, keine Leisten, „Seite einstellen“ gesperrt. Eine **andere** Seite kann B
   bearbeiten.
4. A wechselt zu einer anderen Seite: B tippt **Erneut prüfen** – jetzt geht es.
5. A lässt die Seite offen, ohne etwas zu tun, und schließt den Laptop für über zehn Minuten; B kann die Seite dann übernehmen. Hat B
   etwas gespeichert, zeigt A beim nächsten Handgriff „von jemand anderem geändert – Neu laden“ und überschreibt nichts.
6. Dieselbe Seite in zwei Fenstern desselben Kontos: das zweite zeigt „in einem anderen Fenster von dir geöffnet“.
7. **Neu laden nach dem Bearbeiten:** A ändert etwas („Gespeichert“) und lädt die Browserseite neu. Es steht „in einem anderen Fenster
   von dir geöffnet“ (die eigene Sperre vom alten Fenster) – **Hier weiterbearbeiten**, Rückfrage mit **Übernehmen**: die Leisten
   sind da, Änderungen werden wieder gespeichert.
8. B tippt bei „Gerade bearbeitet von A“ auf **Bearbeitung übernehmen**: Die Rückfrage nennt A und wie lange das letzte
   Lebenszeichen her ist und sagt, dass die ungespeicherten Änderungen verloren gehen. Nach **Übernehmen** kann B bearbeiten; A zeigt
   spätestens nach einer Minute „Ein anderes Fenster hat die Bearbeitung übernommen“, speichert nichts mehr, und seine letzten
   Änderungen bleiben dort sichtbar. **Abbrechen** ändert nichts.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `website/src/Seitenarbeit.tsx`, `shared/website/schlange.ts`, `shared/website/sperre.ts`, `shared/ct/sperre.ts`
- **Automatisiert:** teilweise – `shared/website/schlange.test.ts` (nie zwei gleichzeitig, Fehler zerstört nichts), `shared/website/sperre.test.ts` (Nehmen, Erneuern, Freigeben, Nachlesen), `shared/ct/sperre.test.ts`, `website/src/Seitenarbeit.test.tsx` (Fehler, Sperre, Lebenszeichen, „geändert“, Übernehmen), `website/src/demo.test.ts` (Fall `?demo=eigene` für 7 von Hand); das Zusammenspiel zweier echter Browser und des echten Speichers nur von Hand
- **Historie:** neu mit W3a-2 (20.11.2026); 7 + 8 mit W3a-2c (20.11.2026, nach dem Befund „sperrt sich nach dem Neuladen selbst aus“)

</details>
