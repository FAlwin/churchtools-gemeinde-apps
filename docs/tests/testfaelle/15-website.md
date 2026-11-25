# Website

Die Erweiterung „Website“ (Kürzel `website`, Anleitung `docs/betrieb/WEBSITE.md`). Getestet wird in der **Test-Instanz**,
nie in der Live-Instanz der Gemeinde. Das Paket baut `npm run build -w website` und `npm run paket -w website`; hochladen unter
**Administration → Erweiterungen → Stift beim Modul → ZIP-Datei** (neues Modul: Kürzel genau `website`).

### TF-WEBSITE-01 · Einrichten legt beide Kategorien für die gewählte Gruppe an, ohne Admin gibt es nur den Hinweis

**Das brauchst du:** Die Erweiterung frisch installiert (noch nicht eingerichtet), ein Admin-Konto, in ChurchTools eine Gruppe
„Website“ und eine Person ohne Admin-Recht (ein zweites Konto in einem zweiten Browser).

**Das muss passieren:** Der Admin sieht „Website einrichten“ mit der vorgewählten Gruppe „Website“ und dem Knopf
**Einrichten**. Danach steht der Hinweis „Diese Website hat noch keine Startseite“, und unter Administration → Berechtigungen
stehen bei der Erweiterung die Kategorien „Website: Entwürfe · Website“ und „Website: Veröffentlicht · Website“ – jede genau
einmal. Eine Person ohne Admin-Recht sieht keinen Einrichten-Knopf, sondern einen Hinweis.

1. Als Admin im Menü auf **Website**: „Website einrichten“, die Gruppe „Website“ ist gewählt.
2. Hat dein Konto in ChurchTools „Personen administrieren“, steht über dem Knopf **Einrichten** die Liste der Rollen mit je einer Stufe
   (siehe TF-WEBSITE-12). **Einrichten** tippen: „Wird eingerichtet …“, danach der Rahmen mit den Reitern Seiten · Aussehen · Freigaben.
3. Die Seite neu laden: kein „Einrichten“ mehr.
4. Unter **Administration → Berechtigungen** bei „Website“: beide Kategorien, keine doppelt.
5. Mit dem Konto ohne Admin-Recht (zweiter Browser) die Seite öffnen: Hinweis, kein Knopf.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `website/src/Einrichtung.tsx`, `website/src/einrichten.ts`, `website/src/start.ts`, `shared/website/einrichten.ts`
- **Automatisiert:** teilweise – `website/src/Einrichtung.test.tsx` (seit W3b-1 auch die Rechte je Rolle), `website/src/start.test.ts`, `shared/website/einrichten.test.ts` (Regeln, Laden, Auswahl); das echte Anlegen und die Rechte-Seite von ChurchTools nur in der Test-Instanz
- **Historie:** neu mit W3a-1 (20.11.2026); angepasst an die gemessene Content-Security-Policy mit W3a-2b (20.11.2026); W3b-1 (20.11.2026): Stufen je Rolle beim Einrichten

</details>

### TF-WEBSITE-02 · Zugang: aus den eigenen Rechten – Leitung, Redakteur, sonst nur ein Hinweis

**Das brauchst du:** Eingerichtete Website mit gesetzten Rechten (TF-WEBSITE-12), die Gruppe „Website“ mit einem Leiter, einem
Mitarbeiter und einer Person ohne Rolle; zum Wechseln die Rollen per ChurchTools-Gruppenverwaltung ändern (nicht „Person simulieren“).

**Das muss passieren:** Der Zugang folgt den **Rechten**, nicht der Rolle in der Gruppe: Admin und Leitung (Rechte an Entwürfe **und**
Veröffentlicht) sehen den Rahmen mit allen Reitern, der Redakteur (nur Entwürfe) nur Seiten und Freigaben. Wer keine Rechte hat, sieht
nur den Hinweis „Die Website bearbeiten dürfen die Admins und alle, die in der Gruppe … eine Rolle mit Zugriff auf die Website haben“ –
keinen Editor. Leitet jemand die Gruppe, hat aber keine Rechte, steht „Die Rechte für die Website sind noch nicht eingerichtet“ mit
dem Weg über einen Admin.

1. Als Admin die Erweiterung öffnen: Reiter und Seitenliste.
2. Als **Leiter** der Gruppe (Stufe „Leitung“): dasselbe, dazu „Einstellungen“ ganz rechts.
3. Als **Mitarbeiter** (Stufe „Redakteur“): Seiten und Freigaben, kein Aussehen, kein „Einstellungen“.
4. Dem Mitarbeiter in „Wer darf was“ „Kein Zugriff“ geben, neu laden: nur der Hinweis.
5. Dem Leiter alle Rechte an der Website entziehen (Stufe „Kein Zugriff“), neu laden: „Die Rechte für die Website sind noch nicht
   eingerichtet“.
6. Eine Person ohne Verbindung zur Gruppe: Hinweis („dir fehlt das Recht“ bzw. wer es darf).

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `website/src/App.tsx`, `website/src/start.ts`, `shared/website/zugang.ts`
- **Automatisiert:** teilweise – `website/src/App.test.tsx`, `website/src/start.test.ts`, `shared/website/zugang.test.ts`; das echte Verhalten von Gruppenrollen und Kategorie-Rechten nur in der Test-Instanz
- **Historie:** neu mit W3a-1 (20.11.2026); angepasst an die gemessene Content-Security-Policy mit W3a-2b (20.11.2026); W3b-1 (20.11.2026): Zugang aus den eigenen Rechten statt aus der Rolle, Redakteur

</details>

### TF-WEBSITE-03 · Startseite anlegen, neue Seite, Seite löschen – und die Vorschau

**Das brauchst du:** Die eingerichtete Website (Admin oder Leitung), noch ohne Seite.

**Das muss passieren:** Ohne Seite steht der Hinweis mit dem Knopf **Startseite anlegen** – nichts wird von selbst angelegt. Der
Knopf legt eine Startseite aus der Vorlage an; die Vorschau zeigt sie (Schriftzug), der Umschalter wechselt zwischen **Computer**
und **Handy** (schmaler Rahmen). **Neue Seite** nimmt einen Titel, zeigt die Adresse darunter und legt eine leere Seite an. **Seite
löschen** fragt erst nach. Nach dem Neuladen der Seite steht alles unverändert da.

1. Die Erweiterung öffnen: „Diese Website hat noch keine Startseite“. **Startseite anlegen**.
2. Die Vorschau zeigt die Startseite; **Handy** tippen, dann **Computer**.
3. **Neue Seite** (grün unter der Liste; am Handy das runde grüne Plus), Titel „Über uns“: darunter steht die Adresse `/ueber-uns/`; **Anlegen**. Die Seite steht unter „Weitere Seiten“.
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
Bilder von ChurchTools geladen. Beim Bearbeiten erscheinen in ChurchTools die Leisten an den Abschnitten (die Schicht läuft mit der
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

**Das muss passieren:** Fährt man mit der Maus über einen Abschnitt, steht auf seiner Oberkante seine Leiste (Griff ·
Gestalten · kopieren · löschen), und an der Grenze zwischen den Abschnitten erscheint **Abschnitt einfügen** (die neue Bedien-Schicht
ist in TF-WEBSITE-14 beschrieben). Am Handy genügt ein Tipp auf den Abschnitt. Jede Aktion steht gleich in der Vorschau und oben steht
„Gespeichert“. **Löschen fragt erst nach.** Nach dem Neuladen der Seite steht alles so da.

1. Die Startseite öffnen, mit der Maus über den ersten Abschnitt fahren: die Leiste steht auf der Oberkante, unten mittig die Pille „Abstand: …“.
2. **Abschnitt einfügen** unter dem ersten Abschnitt: Fenster mit den Vorlagen als Kacheln. „Drei Spalten“ wählen – er steht
   dort, oben „Speichert … → Gespeichert“.
3. Den neuen Abschnitt am Griff vor den ersten ziehen (das Ziehen selbst: TF-WEBSITE-15), dann **kopieren**: die Kopie steht darunter.
4. **Löschen** tippen: Rückfrage „Abschnitt löschen?“. **Abbrechen** – nichts passiert. Noch einmal, **Löschen** – er ist weg.
5. Auf einer leeren Seite (neue Seite anlegen): in der Vorschau steht „Diese Seite ist noch leer“ mit dem Knopf **Abschnitt
   einfügen**.
6. Die Seite neu laden: alle Änderungen sind noch da.
7. Dasselbe am Handy: tippen statt fahren; die Fenster passen auf den Bildschirm; die Leiste hat dort noch **nach oben/unten**.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `website/src/Seitenarbeit.tsx`, `website/src/Vorschau.tsx`, `website/src/ebene.skript.txt`, `website/src/ebene.kern.txt`, `website/src/ebene.css`, `website/src/AbschnittEinfuegen.tsx`, `shared/website/bearbeiten.ts`
- **Automatisiert:** teilweise – `website/src/Seitenarbeit.test.tsx`, `website/src/ebene.test.ts`, `shared/website/bearbeiten.test.ts`; wie sich Fahren/Tippen im echten iframe anfühlt nur von Hand
- **Historie:** neu mit W3a-2 (20.11.2026); 7 + 8 mit W3a-2c (20.11.2026, nach dem Befund „sperrt sich nach dem Neuladen selbst aus“); Leiste und Einfügen-Knopf an die neue Bedien-Schicht angepasst mit W3c-1 (21.11.2026)

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
- **Historie:** neu mit W3a-2 (20.11.2026); 7 + 8 mit W3a-2c (20.11.2026, nach dem Befund „sperrt sich nach dem Neuladen selbst aus“); Leiste und Einfügen-Knopf an die neue Bedien-Schicht angepasst mit W3c-1 (21.11.2026)

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
- **Historie:** neu mit W3a-2 (20.11.2026); 7 + 8 mit W3a-2c (20.11.2026, nach dem Befund „sperrt sich nach dem Neuladen selbst aus“); Leiste und Einfügen-Knopf an die neue Bedien-Schicht angepasst mit W3c-1 (21.11.2026)

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
- **Historie:** neu mit W3a-2 (20.11.2026); 7 + 8 mit W3a-2c (20.11.2026, nach dem Befund „sperrt sich nach dem Neuladen selbst aus“); Leiste und Einfügen-Knopf an die neue Bedien-Schicht angepasst mit W3c-1 (21.11.2026)

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
- **Historie:** neu mit W3a-2 (20.11.2026); 7 + 8 mit W3a-2c (20.11.2026, nach dem Befund „sperrt sich nach dem Neuladen selbst aus“); Leiste und Einfügen-Knopf an die neue Bedien-Schicht angepasst mit W3c-1 (21.11.2026)

</details>

### TF-WEBSITE-10 · Aussehen: Farben, Schriften, Kontrast-Hinweis, eigenes CSS – mit Vorschau und Speichern

**Das brauchst du:** Die Website in der Test-Instanz, ein Konto mit Admin- oder Leitungsrecht, eine Startseite; für die Sperre ein
zweites Konto (B) in einem zweiten Browser.

**Das muss passieren:** Im Reiter **Aussehen** steht links das Formular (Farben, Schriften, Logo, Eigenes CSS), rechts die
Vorschau der Startseite. Jede Änderung ist sofort in der Vorschau zu sehen (das eigene CSS nach einem kurzen Moment) und wird
nach etwa einer Sekunde gespeichert („Speichert … / Gespeichert“). Nach einem Neuladen der Seite stehen die Werte wieder da. Am
Handy steht die Vorschau unter dem Formular.

1. Reiter **Aussehen**: Die Farben und die gewählten Schriften stehen so da wie auf der Website; sind noch keine Farben gespeichert, zeigen
   die Hex-Felder die geltenden neutralen Werte grau als Platzhalter („Hauptfarbe dunkel“ mit „(abgeleitet)“); die Seitenwahl der Vorschau
   zeigt „Startseite“ nicht doppelt.
2. In „Hauptfarbe“ eine neue Farbe tippen (`#7a1f3d`) und mit dem Farbwähler eine andere wählen: Die Vorschau färbt Knöpfe und
   Flächen um. Etwas Ungültiges tippen (`rot`, `#12`) und das Feld verlassen: Es springt auf die geltende Farbe zurück, nichts
   wird gespeichert.
3. Bei „Text“ eine sehr helle Farbe (`#dddddd`) wählen: Unter „Text“ erscheinen ruhige Hinweise zum Kontrast – je Problem
   genau einer („Text auf Hintergrund“, „Text auf Sanft“), nicht zusätzlich an den Flächen. **Gespeichert wird trotzdem.** Wieder eine dunkle Farbe: Der Hinweis verschwindet.
4. Bei „Überschriften“ eine andere Schrift wählen (z. B. „Playfair Display“): Die Vorschau zeigt sie nach einem kurzen Moment, die
   Schrift „Text“ bleibt. Die Auswahl ist nach Art gruppiert; „Eigene Schrift …“ zeigt nur den Hinweis zum Hochladen der Bilder.
5. Bei „Eigenes CSS“ etwas eintragen (`.w-fuss { font-size: 0.9rem; }`): Die Vorschau folgt verzögert. Mehr als 20.000 Zeichen:
   „Noch nicht gespeichert“ mit Grund, nichts wird geschrieben.
6. Seite neu laden: Farben, Schriften und CSS sind gespeichert; im Reiter **Seiten** zeigt die Vorschau dieselben Schriften.
7. Netz aus, eine Farbe ändern: „Nicht gespeichert“ mit **Erneut versuchen**, die Vorschau zeigt die Änderung weiter. Netz an,
   **Erneut versuchen**: „Gespeichert“.
8. **Sperre:** A ändert eine Farbe. B öffnet **Aussehen**: Hinweis „Das Aussehen bearbeitet gerade A“, alle Felder abgeschaltet.
   **Bearbeitung übernehmen** (mit Rückfrage) schaltet sie für B frei; bei A erscheint spätestens nach einer Minute der Hinweis, dass
   ein anderes Fenster übernommen hat.
9. Reiter wechseln, kurz nachdem eine Farbe geändert wurde: Die Änderung ist gespeichert (Neuladen zeigt sie).

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `website/src/Aussehen.tsx`, `website/src/useSperrarbeit.ts`, `website/src/schriftLader.ts`, `shared/website/aussehen.ts`, `shared/website/theme.ts`
- **Automatisiert:** teilweise – `website/src/Aussehen.test.tsx` (Farben, ungültiger Hex, Kontrast-Hinweis, Schriften, CSS, Sperre, Speichern scheitert, Verlassen), `shared/website/aussehen.test.ts`, `shared/website/theme.test.ts` (Kontrast, data:-Schrift), `website/src/schriftLader.test.ts` und `useSchriften.test.tsx` (nur gewählte laden, Ladefehler), `shared/website/schriftdateien.test.ts`; die Schriften im echten `iframe` von ChurchTools und das Zusammenspiel zweier Browser nur von Hand
- **Historie:** neu mit W3a-3a (20.11.2026)

</details>

### TF-WEBSITE-11 · Einstellungen: Name, Fußzeile, Datenschutz-Link, YouTube-Text – zusammen mit Aussehen

**Das brauchst du:** Die Website in der Test-Instanz, ein Konto mit Admin- oder Leitungsrecht, mindestens zwei Seiten (am besten eine
mit einem Livestream-Baustein); für die Sperre ein zweites Konto (B) in einem zweiten Browser.

**Das muss passieren:** Ganz rechts in der Reiterleiste steht **Einstellungen** (am Handy unten rechts) und öffnet ein Fenster. Was du
dort einträgst, wird mit **Speichern** gespeichert und gilt für die ganze Website.

1. **Einstellungen** öffnen: Name der Gemeinde, die Fußzeilen-Links, der Datenschutz-Link und der Banner-Text stehen so da, wie sie
   gespeichert sind. Der Banner-Text zeigt, solange er leer ist, den Standardtext grau als Platzhalter.
2. Den Namen ändern, **Link** drücken: Titel „Impressum“, Ziel „Seite: …“ wählen; einen zweiten Link mit „Andere Adresse …“ und
   `https://…`. Mit den Pfeilen die Reihenfolge ändern, mit ✕ einen Link entfernen. Beim zehnten Link ist **Link** abgeschaltet.
3. Bei einer Adresse `javascript:x` eintragen und **Speichern**: Eine Meldung nennt den Link („Fußzeile, Link 2: Erlaubt sind nur
   Adressen …“), nichts wird gespeichert, das Fenster bleibt offen und die Eingabe stehen. Die Adresse berichtigen, **Speichern**: Das
   Fenster schließt; im Reiter **Seiten** steht die Fußzeile mit den neuen Links in der Vorschau.
   **Fenster über „Seiten“ speichern → Vorschau sofort aktuell:** Bleib dabei im Reiter **Seiten** (nicht wechseln, nicht neu laden),
   öffne **Einstellungen**, ändere den Namen, **Speichern**: Die Vorschau zeigt den neuen Namen (und die neue Fußzeile) sofort. Eine
   Änderung an einer Seite, die gerade bearbeitet wird, bleibt dabei erhalten.
4. Mit einem Livestream-Baustein auf einer Seite und **ohne** Datenschutz-Link steht im Fenster ein Hinweis; nach dem Eintragen eines
   Links (Seite oder Adresse) verschwindet er. Den Banner-Text ändern und wieder leeren (dann gilt der Standardtext).
5. **Zusammen mit Aussehen:** Im Reiter **Aussehen** eine Farbe ändern und sofort (ohne zu warten) **Einstellungen** öffnen, den Namen
   ändern, **Speichern**. Seite neu laden: **Beide** Änderungen sind da (Farbe und Name). Dasselbe andersherum: erst Einstellungen,
   dann Aussehen.
6. **Sperre:** A ändert eine Farbe in Aussehen. B öffnet **Einstellungen**: Hinweis, dass A bearbeitet; Felder und **Speichern**
   abgeschaltet. Nach „Bearbeitung übernehmen“ im Reiter Aussehen kann B im Fenster speichern.
7. Netz aus, im Fenster **Speichern**: „Nicht gespeichert …“, das Fenster bleibt mit der Eingabe offen. Netz an, **Speichern**: es
   schließt.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `website/src/EinstellungenFenster.tsx`, `website/src/EinstellungenQuelle.tsx`, `website/src/Aussehen.tsx`, `website/src/App.tsx`, `website/src/Seiten.tsx`, `shared/website/einstellungen.ts`, `shared/website/modell.ts`
- **Automatisiert:** teilweise – `website/src/EinstellungenFenster.test.tsx` (Speichern, Fußzeile, Grenze, ungültige Adresse, Datenschutz-Hinweis, Aussehen + Fenster nacheinander, Fremdsperre), `shared/website/einstellungen.test.ts`, `website/src/App.test.tsx` (Reiter), `website/src/EinstellungenInSeiten.test.tsx` (Fenster über „Seiten“: Vorschau sofort aktuell, Nachlesen scheitert, offene Bearbeitung bleibt); das Zusammenspiel zweier Browser und das Aussehen im echten ChurchTools nur von Hand
- **Historie:** neu mit W3a-3b (20.11.2026); W3a-3c (20.11.2026): Vorschau in „Seiten“ zieht nach dem Speichern im Fenster nach

</details>

### TF-WEBSITE-12 · Rechte: Stufen je Rolle beim Einrichten, „Wer darf was“, Redakteur und Leitung

**Das brauchst du:** Die Website in der Test-Instanz; ein Konto mit „Personen administrieren“ und „Gruppen verwalten“ (Admin); in der
Gruppe „Website“ ein **Leiter**, ein **Mitarbeiter** (beide Konten in zwei weiteren Browsern oder zeitversetzt) und die Untergruppe
nicht nötig. Die Rechte an den Kategorien der Website dürfen vorher von Hand gesetzt sein (dann siehst du Schritt 4).

**Das muss passieren:** Beim Einrichten und später unter **Einstellungen → Wer darf was** wählst du je Rolle **Kein Zugriff · Redakteur ·
Leitung**; **Rechte setzen** setzt die Rechte in ChurchTools und liest nach. Ein **Redakteur** bearbeitet Seiten (Entwürfe), sieht
aber weder **Aussehen** noch **Einstellungen**, kein Menü in „Seite einstellen“ und keinen Baustein „Eigenes HTML“. Die **Leitung**
sieht alles. Wer nicht „Personen administrieren“ hat, sieht „Wer darf was“ nicht.

1. **Einrichten (frisch):** Die Gruppe wählen: Die Rollen stehen mit Stufen da – Leiter und Co-Leiter = Leitung, Mitarbeiter, Coach,
   Organisator = Redakteur. Eine Rolle auf „Kein Zugriff“ stellen, **Einrichten**. Unter Administration → Berechtigungen bei der
   Erweiterung „Website“: Leiter-Rolle hat Modul sehen sowie an „Entwürfe“ **und** „Veröffentlicht“ Kategorie/Daten sehen, anlegen,
   ändern, löschen; die Mitarbeiter-Rolle an „Entwürfe“ alles, an „Veröffentlicht“ **nur** Kategorie sehen und Daten sehen; die Rolle
   mit „Kein Zugriff“ nichts.
2. **Wer darf was:** **Einstellungen** öffnen, nach unten: dieselbe Liste, die Stufen stimmen mit Schritt 1 überein. Dem Mitarbeiter
   „Leitung“ geben, **Rechte setzen**: „Die Rechte sind gesetzt und nachgelesen“; in ChurchTools stehen die Veröffentlicht-Schreibrechte
   jetzt auch bei der Mitarbeiter-Rolle. Wieder auf „Redakteur“ und **Rechte setzen**: Die Schreibrechte an „Veröffentlicht“ sind weg
   (zusätzliche Rechte an **anderen** Kategorien oder Zusatzrechte bleiben).
3. **Als Mitarbeiter (Redakteur):** Reiter nur **Seiten** und **Freigaben**; kein „Einstellungen“. Eine Seite bearbeiten und speichern
   klappt. **Seite einstellen** zeigt Titel, Adresse, Beschreibung – **ohne** „Im Menü zeigen“ und Reihenfolge. Beim Einfügen steht
   „Eigenes HTML“ nicht zur Wahl.
4. **Von Hand verändert:** In ChurchTools der Mitarbeiter-Rolle das Recht „Daten anlegen“ an „Veröffentlicht“ geben. Die Erweiterung als
   Admin neu öffnen: Oben steht ein Hinweis, dass bei „Mitarbeiter“ die Rechte nicht mit der Stufe übereinstimmen; **Wer darf was**
   zeigt „Weicht ab“. **Rechte setzen** richtet es, der Hinweis verschwindet nach dem Schließen des Fensters.
5. **Als Leiter:** Alle Reiter, „Einstellungen“ ohne den Bereich „Wer darf was“, „Eigenes HTML“ und Menü sind da.
6. **Leitung ohne Rechte:** Dem Leiter die Stufe „Kein Zugriff“ geben, als Leiter neu laden: „Die Rechte für die Website sind noch
   nicht eingerichtet“ (kein Editor).
7. **Fehler:** Netz aus, **Rechte setzen**: „Noch nicht gesetzt – …“, die Wahl bleibt stehen. Netz an, **Rechte setzen**: klappt.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/ct/rollenRechte.ts`, `shared/website/rechte.ts`, `shared/website/zugang.ts`, `website/src/rechte.ts`, `website/src/WerDarfWas.tsx`, `website/src/RollenStufen.tsx`, `website/src/RechteHinweis.tsx`, `website/src/Einrichtung.tsx`, `website/src/App.tsx`, `website/src/start.ts`, `website/src/SeiteEinstellen.tsx`, `website/src/EinstellungenFenster.tsx`
- **Automatisiert:** teilweise – `shared/ct/rollenRechte.test.ts` (Ablauf Ist → setzen → entziehen → nachschieben → nachlesen, Fehlerzweige), `shared/website/rechte.test.ts` (Soll je Stufe, Stufe aus Rechten inkl. Mischzustand, Vorbelegung, Hinweis), `shared/website/zugang.test.ts`, `website/src/rechte.test.ts`, `website/src/WerDarfWas.test.tsx`, `website/src/Einrichtung.test.tsx`, `website/src/App.test.tsx` (Redakteur/Leitung/Admin), `website/src/Seitenarbeit.test.tsx` (Menü), `website/src/demo.test.ts`; die echten Rechte in ChurchTools und das Zusammenspiel mehrerer Konten nur in der Test-Instanz
- **Historie:** neu mit W3b-1 (20.11.2026)

</details>

### TF-WEBSITE-13 · Freigabe: einreichen, freigeben, zurückgeben, Löschen anfragen, Alles freigeben

**Das brauchst du:** Die Website in der Test-Instanz, eingerichtet, mit einer Testperson (Spike, 19) in der Gruppe „Website“ – **ihre
Rolle wechselst du per Werkzeug** (Leiter ↔ Mitarbeiter), **nicht** über „Person simulieren“ – und ein Admin-Konto. Mindestens zwei Seiten,
eine davon im Menü.

**Das muss passieren:** Ein **Redakteur** (Mitarbeiter) sieht an jeder Seite, wo sie steht (**Entwurf · Eingereicht · Zurück · Online**),
reicht sie **zur Prüfung ein** und kann das Löschen nur **anfragen**. Die **Leitung** sieht alles im Reiter **Freigaben**, gibt frei, gibt mit
Anmerkung zurück, bestätigt oder lehnt ein angefragtes Löschen ab. Was die Leitung freigibt, steht danach **unverändert in der Kategorie
„Veröffentlicht“**. Der **Zähler** am Reiter „Freigaben“ zählt bei der Leitung Eingereichtes und „Löschen angefragt“, beim Redakteur
Zurückgegebenes.

1. **Redakteur, erste Seite:** Als Mitarbeiter eine Seite ändern (Text), warten bis „Gespeichert“. An der Seite steht **Entwurf** und
   **Zur Prüfung einreichen**. Tippen: Etikett **Eingereicht**, der Knopf ist weg. Die Seite weiter ändern ist erlaubt – das Etikett bleibt
   „Eingereicht“. Beim Menü in „Seite einstellen“ fehlen „Im Menü zeigen“ und die Reihenfolge; dort steht **Löschen anfragen** statt „Seite löschen“.
2. **Leitung:** Als Leiter im Reiter **Freigaben**: Zähler **1**, die Seite steht unter „Eingereicht“ mit „von … am …“. Die Vorschau zeigt den
   **neuesten** Entwurf (auch die Änderung aus Schritt 1 nach dem Einreichen). **Mit Anmerkung zurück** geht nur mit einer Anmerkung.
   „Bitte Überschrift ändern“ eintragen, zurückgeben: Die Seite wandert nach „Zurückgegeben“, der Zähler der Leitung ist **0**.
3. **Redakteur:** Der Zähler am Reiter **Freigaben** steht auf **1**; an der Seite steht **Zurück** und über der Vorschau die Anmerkung
   „Bitte Überschrift ändern“. Ändern, **Zur Prüfung einreichen** (erneut möglich): **Eingereicht**, die Anmerkung ist weg, der Zähler **0**. Im
   Reiter Freigaben stehen nur **seine** Seiten, ohne einen einzigen Knopf; weder Menü noch Einstellungen sind dort zu sehen.
4. **Freigeben:** Als Leiter die Seite **Freigeben**: „… ist online.“ In ChurchTools (Administration → Erweiterung „Website“ → Daten, Kategorie
   „Veröffentlicht“) liegt jetzt ein Kopf dieser Seite; **der Stand im Kopf ist derselbe wie in „Entwürfe“**. An der Seite steht **Online**, bei
   Leitung wie Redakteur; der Redakteur hat keinen „Einreichen“-Knopf mehr. Die Seite im Entwurf ändern: **Geändert**, „Zur Prüfung
   einreichen“ ist wieder da. **Dasselbe Speichern ohne Änderung** (Seite öffnen, nichts tun) macht sie nicht „Geändert“.
5. **Direkt veröffentlichen:** Als Leiter eine andere Seite ändern: unter „⋯“ **Veröffentlichen** – „Online“. Der Knopf fehlt, solange die
   Seite schon so online steht, und ist aus, solange etwas nicht gespeichert ist.
6. **Menü und Aussehen:** Als Leiter das Menü ändern (eine Seite hinzufügen, die noch nicht online ist) und Farben ändern: Unter
   **Freigaben → Menü und Aussehen** stehen **Menü** und **Einstellungen und Aussehen**; beim Menü der Hinweis auf die Seite, die noch nicht
   online ist. **Veröffentlichen** je Eintrag. Ein Redakteur sieht diese Einträge nie.
7. **Löschen anfragen:** Als Redakteur bei einer Seite **Löschen anfragen** → Rückfrage → „Löschen angefragt“; die Seite bleibt, das Menü
   bleibt. Als Leiter: Zähler **1**, Gruppe **Löschen angefragt**. **Ablehnen** → die Seite bleibt, der Status ist weg. Noch einmal anfragen,
   dann **Löschen und offline nehmen** → Rückfrage → die Seite ist weg (Entwurf **und** „Veröffentlicht“), der Menüeintrag auch.
8. **Online, aber Entwurf gelöscht:** Als Leiter eine online stehende Seite über „Seite einstellen“ **löschen** (der Hinweis sagt, dass sie
   online bleibt). Unter Freigaben: Gruppe **Nur noch online** → **Offline nehmen**.
9. **Alles freigeben:** Zwei Seiten einreichen lassen, dazu eine **dritte nur ändern, nicht einreichen**; das Menü ändern. Als Leiter **Alles
   freigeben**: Die Rückfrage nennt die beiden eingereichten Seiten und das Menü – **nicht** die dritte. Danach steht die dritte weiter
   unter „Änderungen“.
10. **Fehler:** Während einer Freigabe das Netz trennen: Meldung „… wurde nicht veröffentlicht – online steht weiter die bisherige Fassung“;
    das Etikett bleibt **Eingereicht**. Netz an, **Freigeben**: klappt. Dem Leiter das Recht „Daten anlegen“ an „Veröffentlicht“ entziehen:
    **Freigeben** meldet „Dafür fehlt dir das Recht …“ (nicht „abgemeldet“).

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/website/status.ts`, `shared/website/freigabe.ts`, `shared/website/speicher.ts`, `shared/website/zugang.ts`, `website/src/Freigaben.tsx`, `website/src/FreigabeLeiste.tsx`, `website/src/freigabeAnzeige.ts`, `website/src/Seiten.tsx`, `website/src/Seitenarbeit.tsx`, `website/src/SeiteEinstellen.tsx`, `website/src/App.tsx`, `website/src/daten.ts`
- **Automatisiert:** teilweise – `shared/website/status.test.ts` (Status schreiben, lesen, nachlesen, Waisen), `shared/website/freigabe.test.ts` (Online-Vergleich in allen vier Zuständen, Freigeben schreibt den Entwurfstext unverändert, Status erst nach dem Nachlesen und nur bei unverändertem Entwurf, vorübergehende Fehler, `401`/`403`, halb geschriebene Freigabe, Offline nehmen, „Alles freigeben“, Liste und Zähler je Rolle), `website/src/Freigaben.test.tsx`, `website/src/FreigabeLeiste.test.tsx`, `website/src/Seiten.freigabe.test.tsx`, `website/src/Seiten.freigabe-offen.test.tsx`, `website/src/App.test.tsx` (Zähler), `website/src/demo.test.ts`; die echten Rechte in ChurchTools („Veröffentlicht“ lesen/schreiben je Rolle), das Zusammenspiel zweier Konten und der Rollenwechsel nur in der Test-Instanz
- **Historie:** neu mit W3b-2 (20.11.2026)

</details>

### TF-WEBSITE-14 · Neue Bedien-Schicht und Text direkt tippen (Überschrift, Text, Knopf, Link, Escape)

**Das brauchst du:** Die eingerichtete Website (Admin oder Leitung) mit einer Seite, die mindestens hat: eine Überschrift, eine Akzentzeile, einen Text, eine
Knopfreihe, einen **dunklen** Abschnitt (Hauptfarbe) und zwei Spalten. Zuerst am Computer (breites Fenster), danach am Handy. Dazu ein zweites Konto
(Redakteur ohne „Eigenes HTML“) und ein zweites Browserfenster für die Sperre.

**Das muss passieren:** Alles Bedienbare steht **nie über Text und nie übereinander**, auf hellem wie auf dunklem Abschnitt gut lesbar. Ein Klick auf einen
Text schreibt direkt in der Seite; **fett · kursiv · Link · Liste · Zwischenüberschrift** gibt es beim Markieren. Was man tippt, erscheint danach
**genau so**, auch Sonderzeichen. Gespeichert wird erst beim Übernehmen („Gespeichert“ oben), ein Fehler bleibt sichtbar.

1. **Leisten:** Mit der Maus über den ersten Abschnitt: die Abschnitt-Leiste steht auf der Oberkante (Griff · Gestalten · kopieren · löschen), unten
   mittig die Pille „Abstand: …“. Über eine Überschrift fahren: **eine** helle Leiste mit dem Stift. Dasselbe auf dem **dunklen** Abschnitt – nichts liegt über
   dem Text, alles ist lesbar. Der Stift öffnet das Fenster des Bausteins, die Pille das Fenster „Gestalten“. An der Grenze zweier Abschnitte steht **Abschnitt
   einfügen**, in einer Lücke zwischen Bausteinen ein **+**. Der Griff verschiebt den Abschnitt (Ziehen: TF-WEBSITE-15).
2. **Überschrift tippen:** Auf die Überschrift klicken, Text ändern, **Eingabetaste**: „Gespeichert“, die Überschrift steht neu da (auch der Punkt dahinter).
   Noch einmal klicken, etwas ändern, **Esc**: der alte Text steht wieder da, es wird nichts gespeichert. Die Überschrift ganz leeren und übernehmen:
   Hinweis „Das geht so nicht“, der alte Text bleibt.
3. **Text tippen:** In den Text klicken, ein Wort **doppelklicken**: die kleine Leiste erscheint. **F** macht es fett, nochmal **F** nimmt es zurück; **K** kursiv;
   **Liste** macht aus der Zeile einen Punkt, **H** eine Zwischenüberschrift. **Eingabe** macht einen neuen Absatz, **Umschalt+Eingabe** einen Zeilenumbruch.
   **Strg/Cmd+Z** nimmt zurück, **Umschalt+Strg/Cmd+Z** (oder Strg+Y) stellt wieder her – auch nach Fett. Klick daneben: übernommen, gespeichert.
4. **Link:** Wort markieren, **Link**, im Feld `javascript:alert(1)` eintragen, OK: der Hinweis „Erlaubt: https://, http://, mailto:, tel: oder /seite –
   ohne Leerzeichen“, **kein** Link. Dann `https://example.org` – das Wort ist ein Link. Wort im Link markieren, **Link** noch einmal: der Link ist weg.
5. **Sonderzeichen:** In einem Text die Zeile `2 * 3 und [x]` tippen, in einer neuen Zeile `- kein Punkt`, in der nächsten `1. keine Nummer`, in der nächsten
   `### kein Titel`, dazu `\a_b`. Übernehmen: **alles erscheint genau so**, kein Punkt, keine Liste, kein Titel, kein Kursiv. Das Fenster „Baustein bearbeiten“
   zeigt im Text `2 \* 3 und \[x\]`, `\- kein Punkt` usw. (der Backslash macht ein Zeichen zum Zeichen).
6. **Einfügen:** Text mit HTML (`<b>x</b> *y*`) aus der Zwischenablage in ein Textfeld einfügen: er erscheint als Text, nicht fett. In eine Überschrift einen
   Text mit Zeilenumbrüchen einfügen: eine Zeile.
7. **Mehrere Felder:** Während man in der Überschrift tippt, in den Text klicken: die Überschrift ist übernommen und im Text geht es gleich weiter. Es wird
   **nicht** neu gezeichnet, solange man tippt.
8. **Nicht übernommen:** Im Text ein Wort kursiv und das nächste **ohne Leerzeichen dazwischen** fett machen, übernehmen: Hinweis „… lassen sich im Text nicht
   speichern“, der Text bleibt, wie er war.
9. **Eigenes HTML:** Auf einem Baustein „Eigenes HTML“ lässt sich nicht tippen; ein Klick öffnet das Fenster (Leitung). Als **Redakteur**: auf dem
   Baustein weder Stift noch Fenster; Überschrift und Text lassen sich tippen.
10. **Fremd gesperrt:** Im zweiten Browserfenster dieselbe Seite öffnen und etwas ändern; im ersten Fenster (neu geladen): Hinweis „Gerade bearbeitet von …“,
    **keine** Leisten, kein Tippen.
11. **Fehler beim Speichern:** Das Netz trennen, einen Text ändern und übernehmen: „Nicht gespeichert“ mit **Erneut versuchen**, der Text steht weiter da. Netz an,
    **Erneut versuchen**: „Gespeichert“.
12. **Handy:** Ansicht „Handy“: Hinweis über der Vorschau, nur die Abschnitt-Leiste und Abschnitt einfügen; ein Tipp auf einen Baustein – auch auf Text – öffnet
    das Fenster, kein Tippen im Text.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `website/src/ebene.skript.txt`, `website/src/ebene.kern.txt`, `website/src/ebene.css`, `website/src/ebene.ts`, `website/src/nachricht.ts`, `website/src/textAenderung.ts`, `website/src/Vorschau.tsx`, `website/src/Seitenarbeit.tsx`, `website/src/markdownLeiste.ts`, `shared/website/markdown.ts`
- **Automatisiert:** teilweise – `shared/website/markdown.test.ts` (Escape jedes Zeichens, Zeilenanfang, Hin und Zurück, Vergleich mit dem Stand vor dem Escape), `website/src/ebene.kern.test.ts` (Kollisionsregel, Textmodell, Lesen/Zeichnen), `website/src/ebene.test.ts` + `website/src/ebene.tippen.test.ts` (die Schicht im Dokument nachgespielt), `website/src/nachricht.test.ts`, `website/src/textAenderung.test.ts`, `website/src/Vorschau.test.tsx`, `website/src/Seitenarbeit.text.test.tsx` (Speichern, Fehler, Fremdsperre, Rollen); wie sich Maus, Leisten und Cursor im echten iframe anfühlen, und dass ChurchTools das Skript mit der Nonce zulässt, nur von Hand
- **Historie:** neu mit W3c-1 (21.11.2026); im Browser gemessen: ein `<form>` im abgeschotteten iframe schickt nie ab (Link-Feld ohne Formular), und der Browser meldet „Wiederholen“ nur, wenn in seinem eigenen Verlauf etwas liegt (eigener Verlauf mit Tasten)

</details>

### TF-WEBSITE-15 · Ziehen (Abschnitt, Baustein) und Rückgängig/Wiederholen

**Das brauchst du:** Die eingerichtete Website (Admin oder Leitung) mit einer Seite, die mindestens **drei Abschnitte** hat, darunter einen mit **zwei
oder drei Spalten**, einen mit einer **leeren Spalte** und einen mit „Eigenes HTML“. Breites Fenster (Computer). Dazu ein Redakteur-Konto (ohne „Eigenes
HTML“) und ein zweites Browserfenster.

**Das muss passieren:** Abschnitte und Bausteine lassen sich am **Griff** ziehen; eine Linie zeigt, wo sie landen, beim Baustein ist die Zielspalte
gestrichelt. Das Ergebnis steht sofort in der Vorschau, oben „Gespeichert“. **Rückgängig** und **Wiederholen** nehmen jeden dieser Schritte (und Einfügen,
Kopieren, Löschen, getippten Text) zurück. Am Handy bleibt alles wie bisher.

1. **Baustein ziehen:** Mit der Maus über einen Baustein, am Griff (links in der kleinen Leiste) festhalten und ziehen. Erst nach ein paar Pixeln beginnt das
   Ziehen; ein **Geist** nennt „Typ: Anfang des Texts“, die Quelle ist blass. Zwischen zwei Bausteine einer **anderen Spalte** loslassen: er steht dort, die
   Linie war an der richtigen Stelle, „Gespeichert“.
2. **In einen anderen Abschnitt** und **in die leere Spalte** ziehen: die leere Spalte wird beim Darüberfahren gestrichelt, der Baustein landet darin. Der
   Knopf „Baustein hinzufügen“ dort ist weg, sobald etwas drin ist.
3. **Abschnitt ziehen:** Am Griff der Abschnitt-Leiste einen Abschnitt nach unten und nach oben ziehen; die Linie läuft über die ganze Breite. Beim Ziehen
   über den **Rand** des Fensters scrollt die Seite von selbst. Es gibt **keine** Knöpfe „nach oben/unten“ mehr.
4. **Abbrechen:** Während des Ziehens **Esc**: nichts ändert sich, die Markierungen verschwinden. Loslassen **an derselben Stelle** oder direkt über/unter
   dem Element: nichts ändert sich, nichts wird gespeichert.
5. **Pfeiltasten:** Den Griff mit Tab oder Klick fokussieren, **Pfeil hoch/runter**: eine Stelle weiter. (Nach dem Neuzeichnen muss der Griff neu fokussiert
   werden.)
6. **Rückgängig:** Oben in der Kopfzeile ↶ klicken: der letzte Schritt ist weg, ↷ ist jetzt aktiv. ↷ stellt ihn wieder her. Dasselbe mit **Strg/Cmd+Z** und
   **Umschalt+Strg/Cmd+Z** – auch dann, wenn der Mauszeiger in der Vorschau war. Mehrere Schritte nacheinander zurück, ein neuer Schritt danach: ↷ ist aus.
   Auch **Abschnitt kopieren**, **löschen**, **einfügen**, ein Fenster mit **Fertig** und ein getippter Text lassen sich zurücknehmen.
7. **Im Textfeld:** In einem Text tippen und **Strg/Cmd+Z**: es gilt der Verlauf des Feldes (die Seite springt nicht zurück).
8. **Seite wechseln:** Zu einer anderen Seite und zurück: ↶ und ↷ sind aus (Verlauf leer). Nach „Seite einstellen“ → Fertig sind sie ebenfalls aus.
9. **Fremde Änderung:** Im zweiten Fenster dieselbe Seite öffnen und etwas ändern; im ersten ↶ klicken: es wird **nicht** darüber geschrieben (Band „Neu
   laden“ oder Hinweis), die Änderung aus dem zweiten Fenster bleibt.
10. **Eigenes HTML:** Als Redakteur hat „Eigenes HTML“ keinen Griff (keine Leiste); andere Bausteine daneben lassen sich ziehen. Als Leitung lässt es sich
    ziehen.
11. **Fremd gesperrt:** Ist die Seite von jemand anderem gesperrt, gibt es keine Leisten, kein Ziehen, ↶ ↷ sind aus.
12. **Handy:** Ansicht „Handy“: kein Ziehen, keine Baustein-Leiste, die Abschnitt-Leiste hat noch nach oben/unten; ↶ ↷ stehen nicht in der Kopfzeile.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/website/bearbeiten.ts`, `website/src/ebene.skript.txt`, `website/src/ebene.css`, `website/src/nachricht.ts`, `website/src/Seitenarbeit.tsx`, `website/src/seitenVerlauf.ts`, `website/src/demo.ts`
- **Automatisiert:** teilweise – `shared/website/bearbeiten.test.ts` (Regeln, Index-Verschiebung, ungültige Stellen), `website/src/nachricht.test.ts` (Nachricht `verschieben`), `website/src/ebene.ziehen.test.ts` (Ziehen im nachgespielten Dokument mit festgelegten Maßen), `website/src/Seitenarbeit.ziehen.test.tsx` (Weg bis zum Speichern, Verlauf, Tasten, Rollen), `website/src/seitenVerlauf.test.ts`; wie sich Ziehen, Esc und Auto-Scroll im echten iframe anfühlen nur von Hand (am 21.11.2026 mit Playwright geprüft: Ziehen, Esc, Strg+Z mit Fokus im iframe)
- **Historie:** neu mit W3c-2 (21.11.2026); im Browser gemessen: Esc kam im iframe nicht an, solange der Griff keinen Fokus nahm (Fokus beim Greifen)

</details>

### TF-WEBSITE-16 · Maße ziehen: Spaltenbreite und Abstand

**Das brauchst du:** Die eingerichtete Website (Admin oder Leitung) mit einer Seite, die einen **zweispaltigen** Abschnitt, einen mit **drei** oder **vier Spalten** und
einen Abschnitt auf **dunkler Fläche** (Hauptfarbe oder Bild) hat – die Demo (`?demo=…`) hat beides. Breites Fenster (Computer). Dazu ein Redakteur-Konto und ein zweites Browserfenster.

**Das muss passieren:** Spaltenbreite und Abstand lassen sich direkt in der Vorschau ziehen; sie rasten ein, die Seite folgt live, ein Chip sagt, wohin es rastet. Das Ergebnis
steht nach dem Loslassen in der Vorschau, oben „Gespeichert“, und lässt sich mit ↶ ↷ zurücknehmen. Am Handy bleibt alles beim Fenster „Gestalten“.

1. **Spaltenbreite ziehen:** Mit der Maus in den zweispaltigen Abschnitt. In der Lücke zwischen den Spalten erscheint ein heller **Griff** (drei Punktreihen), er liegt nie über Text.
   Festhalten und nach rechts ziehen: **gestrichelte Linien** zeigen die Aufteilungen (1 : 2, 1 : 1, 2 : 1), die nächste ist durchgezogen, ein **Chip „Aufteilung 2 : 1“** folgt dem
   Zeiger, die Spalten ändern ihre Breite sofort. Loslassen: die Breite bleibt, „Gespeichert“. Nach links ziehen: 1 : 2. In die Mitte: „1 : 1 (gleich breit)“.
2. **Abbrechen:** Während des Ziehens **Esc**: Linien und Chip verschwinden, die Spalten sind wieder wie vorher, nichts wird gespeichert. Loslassen auf der Aufteilung, die schon
   galt: ebenfalls nichts.
3. **Drei und vier Spalten:** Im Abschnitt mit drei Spalten sind die Griffe **blass**, der Zeiger zeigt „nicht erlaubt“; ein Klick darauf zeigt kurz den Hinweis „Bei 3 Spalten
   gibt es nur eine Aufteilung – änderbar über Gestalten“. Es lässt sich nichts ziehen. Die Spaltenzahl ändert man weiter im Fenster „Gestalten“.
4. **Abstand ziehen:** Über einem Abschnitt unten mittig steht die Pille **„Abstand oben & unten: Normal“**. Festhalten und nach unten ziehen: zwei **gestreifte Bänder** (oben und
   unten, gleich hoch, hell gesäumt) zeigen die Abstandshöhe, der Chip sagt „Abstand oben und unten: Groß“, der Abschnitt wächst live. Nach oben bis „Kein“: die Bänder sind weg,
   der Abschnitt liegt eng an den Nachbarn. Loslassen: die Stufe bleibt, „Gespeichert“. Dasselbe auf dem Abschnitt mit **dunkler Fläche**: die Bänder sind gut zu sehen.
5. **Klick ohne Ziehen:** Ein einfacher Klick auf die Pille öffnet das Fenster „Gestalten“ (Abstand dort unverändert). Nach einem Zug öffnet sich **kein** Fenster.
6. **Abbrechen beim Abstand:** Ziehen, dann **Esc**: Stufe wie vorher, nichts gespeichert.
7. **Tastatur:** Die Pille mit Tab fokussieren, **Pfeil runter/hoch**: eine Stufe mehr/weniger; am Spalten-Griff **Pfeil rechts/links**: die nächste Aufteilung. **Enter** an der Pille
   öffnet „Gestalten“.
8. **Rückgängig:** Nach jedem Zug ↶: Breite bzw. Abstand sind wie vorher, ↷ stellt sie wieder her; mit **Strg/Cmd+Z** genauso. Beides nacheinander sind zwei Schritte.
9. **Nichts geht verloren:** Nach dem Ändern der Breite stehen alle Bausteine wie zuvor in ihren Spalten.
10. **Redakteur:** Als Redakteur (ohne „Eigenes HTML“) lassen sich Breite und Abstand ebenfalls ziehen.
11. **Fremd gesperrt:** Ist die Seite von jemand anderem gesperrt, gibt es keine Griffe und keine Pille.
12. **Keine Überlagerung:** Mit der Maus über den ganzen Abschnitt fahren: Spalten-Griff, Pille, Leisten und „+“ liegen nie über Text und nie übereinander.
13. **Handy:** Ansicht „Handy“: keine Griffe, keine Pille; Abstand und Spalten ändert man im Fenster „Gestalten“.

<details><summary>Technisches</summary>

- **Priorität:** normal
- **Betrifft:** `shared/website/bearbeiten.ts`, `website/src/ebene.kern.txt`, `website/src/ebene.skript.txt`, `website/src/ebene.css`, `website/src/ebene.ts`, `website/src/nachricht.ts`, `website/src/Seitenarbeit.tsx`, `website/src/demo.ts`
- **Automatisiert:** teilweise – `shared/website/bearbeiten.test.ts` (Aufteilung nur mit gleicher Spaltenzahl, Gestaltung), `website/src/ebene.kern.test.ts` (Rastung, Messung der Stufen), `website/src/nachricht.test.ts` (Nachrichten `aufteilung`/`abstand`), `website/src/ebene.masse.test.ts` (Griff, Pille, Rastlinien, Chip, Bänder, Esc, Klick im nachgespielten Dokument mit festgelegten Maßen), `website/src/Seitenarbeit.masse.test.tsx` (Weg bis zum Speichern, Rückgängig, Rechte, Sperre); wie es sich im echten iframe anfühlt (Zeiger festhalten, Bänder auf dunkler Fläche) nur von Hand
- **Historie:** neu mit W3c-3 (21.11.2026)

</details>

### TF-WEBSITE-17 · Mails im Freigabe-Weg: Einreichen, Löschen anfragen, Zurückgeben, Freigeben – und der Schalter

**Das brauchst du:** Die Test-Instanz (**sie verschickt echte Mails** – nur an Testadressen), die Website eingerichtet, die Gruppe „Website“ mit
zwei Konten, die du erreichst: eine **Leitung** (Leiter, Mail-Adresse zum Mitlesen) und ein **Redakteur** (Mitarbeiter, ebenfalls mit Adresse),
dazu ein Admin-Konto. Zwei Browser. Mindestens zwei Seiten.

**Das muss passieren:** Beim Einreichen und beim Löschen anfragen bekommt die **Leitung** eine kurze Mail, beim Zurückgeben und Freigeben
bekommt sie die Person, die **eingereicht** hatte. **Nie an sich selbst.** Im Fenster „Einstellungen“ gibt es den Haken **Mails im
Freigabe-Weg**; ist er aus, geht keine Mail und es erscheint kein Hinweis. Eine fehlgeschlagene Mail ändert nie, was die Handlung getan hat.

1. **Leitung festhalten:** Als Admin unter Einstellungen → „Wer darf was“ die Stufen prüfen (Leiter = Leitung, Mitarbeiter = Redakteur) und
   **Rechte setzen** → „Die Rechte sind gesetzt und nachgelesen.“ In ChurchTools (Administration → Erweiterung „Website“ → Daten, Kategorie
   „Entwürfe“) steht ein Wert `website-leitung` mit der Rolle des Leiters. Ein zweites „Rechte setzen“ ändert daran nichts.
2. **Einreichen:** Als Redakteur eine Seite ändern, **Zur Prüfung einreichen**: Unter der Werkzeugleiste steht „Die Leitung ist per Mail
   benachrichtigt.“ Beim Leiter kommt eine Mail an: Betreff **Website: „…“ wartet auf Freigabe**, im Text der Name des Redakteurs, die Seite
   und ein Link „Website in ChurchTools öffnen“ (führt auf die Erweiterung; der Reiter „Freigaben“ steht im Text). Der Redakteur bekommt **keine** Mail.
3. **Löschen anfragen:** Als Redakteur bei einer anderen Seite **Löschen anfragen** → Mail an den Leiter mit **„– Löschen angefragt“** im Betreff.
4. **Zurückgeben:** Als Leiter bei der eingereichten Seite **Mit Anmerkung zurück** („Bitte Überschrift ändern“): Hinweis „Wer eingereicht hatte,
   ist per Mail benachrichtigt.“ Der **Redakteur** bekommt eine Mail **„… zurückgegeben“** mit der Anmerkung; der Leiter keine.
5. **Freigeben:** Redakteur reicht erneut ein, Leiter **Freigeben** → Mail an den Redakteur **„… ist freigegeben“**. Eine Änderung, die nie
   eingereicht war, über „⋯“ → **Veröffentlichen**: **keine** Mail.
6. **Alles freigeben:** Der Redakteur reicht **zwei** Seiten ein, der Leiter **Alles freigeben**: Der Redakteur bekommt **genau eine** Mail
   („2 Seiten sind freigegeben“, beide Seiten aufgelistet), nicht zwei.
7. **Nie an sich selbst:** Als Leiter selbst eine Seite einreichen lassen geht nicht (Leitung veröffentlicht direkt); stattdessen mit dem Admin-Konto,
   das zugleich die einzige Leitung ist: Es bekommt keine Mail für das, was es selbst tut – und es erscheint **kein Fehler und kein Hinweis**.
8. **Schalter aus:** Als Leiter im Fenster **Einstellungen** den Haken **Mails im Freigabe-Weg** ausschalten (wirkt **sofort**, ohne „Speichern“; das
   Fenster bleibt offen). Als Redakteur einreichen: **keine Mail, kein Hinweis**. Wieder einschalten: die nächste Mail kommt. Seite neu laden:
   der Haken steht, wie er war. „Speichern“ im Fenster ändert den Haken nicht, und eine Meldung beim Haken meldet nie die Einstellungen als
   gescheitert.
9. **Eigener Wert:** Der Haken liegt als Wert `website-mail` in „Entwürfe“ – **nicht** in der Einheit „Einstellungen“ (die Leitung muss nichts
   „Freigeben“, damit er wirkt).
10. **Mail scheitert:** Dem Redakteur-Konto in ChurchTools das Recht, Mails zu senden, nehmen (oder die Mail-Adresse der Leitung entfernen) und
    einreichen: Der Hinweis sagt „Die Mail an die Leitung ging nicht raus: …“ und dass die Seite **trotzdem eingereicht** ist – das Etikett
    steht auf **Eingereicht**, die Seite erscheint beim Leiter unter „Freigaben“. Es wird **nichts automatisch wiederholt**.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `ui/ct/mailSenden.ts`, `shared/website/mail.ts`, `shared/website/mailWerte.ts`, `shared/website/speicher.ts`, `website/src/mailVersand.ts`, `website/src/MailSchalter.tsx`, `website/src/EinstellungenFenster.tsx`, `website/src/Seiten.tsx`, `website/src/Freigaben.tsx`, `website/src/rechte.ts`, `website/src/WerDarfWas.tsx`, `website/src/freigabeAnzeige.ts`, `anmeldungen/src/rundmail.ts`
- **Automatisiert:** teilweise – `shared/website/mail.test.ts` (Empfänger je Anlass, Vorbelegung statt Wert, nie an sich selbst, Bündeln, Texte, HTML-Schutz, Link), `shared/website/mailWerte.test.ts` (beide Werte lesen/schreiben/nachlesen, beschädigt = fehlend, beim Lesen der Website übersprungen), `ui/ct/mailSenden.test.ts` (Zweige des Versands; die früheren Tests des Anmelde-Tools), `website/src/mailVersand.test.ts` (Schalter, Leitung, Mitglieder, die fünf Ausgänge), `website/src/Seiten.freigabe.test.tsx` und `website/src/Freigaben.test.tsx` (richtige Empfänger, erst nach dem Nachlesen, keine Mail bei gescheiterter Handlung, drei Hinweise), `website/src/EinstellungenFenster.mail.test.tsx` (Haken wirkt sofort, getrennte Fehler), `website/src/rechte.test.ts` (Admin setzt Stufen → Wert geschrieben); dass die Mail wirklich ankommt, der Link stimmt und wie sie in einem Mailprogramm aussieht, nur von Hand in der Test-Instanz
- **Historie:** neu mit W3b-3 (23.11.2026)

</details>

### TF-WEBSITE-18 · Untergruppen einrichten: Kategorie, Rechte, „Wer darf was“ und Hinweis beim Start

**Das brauchst du:** Die Website in der Test-Instanz (Gruppe „Website“ 344, Alwin Leiter); die Untergruppe **„Website – Jugend“** (347) mit Spike
als Mitarbeiter, dazu eine **zweite, neue Untergruppe** direkt unter „Website“ (z. B. „Website – Technik“) und eine Gruppe **unter** „Website –
Jugend“ (Enkel). Ein Admin-Konto mit „Personen administrieren“. Für die Rollen-Wechsel von Spike das Werkzeug benutzen, **nicht** „Person
simulieren“. Seit der Messung W3b-4-0 gibt es schon die Kategorie **117** `veroeffentlicht-g347`.

**Das muss passieren:** Unter **Einstellungen → Wer darf was** steht unter der Gruppe „Website“ je **direkte** Untergruppe ein Abschnitt (der
Enkel nicht). Eine noch nicht eingerichtete Untergruppe zeigt „noch nicht eingerichtet“ und die Vorbelegung (Leiter = Leitung, sonst Redakteur);
**Rechte setzen** legt ihre Kategorie „Website: Veröffentlicht · …“ an, vergibt die Rechte ihrer Rollen und zieht **danach** die Rollen der
Website nach – mit den Stufen, die sie schon haben. Beim Start sieht der Admin einen Hinweis, solange eine Untergruppe nicht eingerichtet ist oder
ihre Rechte abweichen.

1. **Hinweis beim Start:** Als Admin die Erweiterung öffnen: Oben steht „Die Untergruppe „Website – Technik“ ist noch nicht eingerichtet.“ Bei
   „Website – Jugend“ steht (seit der Messung fehlt dort das Lesen an „Veröffentlicht“ der Website) „In der Untergruppe „Website – Jugend“ weichen
   die Rechte ab: …“.
2. **Wer darf was:** **Wer darf was** im Hinweis tippen. Unter der Liste der Website zwei Abschnitte „Website – Jugend“ und „Website – Technik“,
   der Enkel fehlt. Bei „Website – Jugend“ steht bei der Mitarbeiter-Rolle „Weicht ab“, bei „Website – Technik“ der Hinweis „noch nicht
   eingerichtet“ mit Leiter = Leitung, Mitarbeiter = Redakteur.
3. **Jugend richten:** Bei „Website – Jugend“ **Rechte setzen** → „Die Rechte sind gesetzt und nachgelesen.“ In ChurchTools (Administration →
   Berechtigungen, Erweiterung „Website“): Jugend-Mitarbeiter (3320) hat Modul sehen, „Entwürfe“ alles, **„Veröffentlicht“ (107) nur
   sehen** und an **117 nur sehen**; Jugend-Leiter (3323) zusätzlich **117 anlegen/ändern/löschen** – aber **nie** Schreiben an 107. Es wurde
   **keine** zweite Kategorie `veroeffentlicht-g347` angelegt.
4. **Technik einrichten:** Bei „Website – Technik“ eine Rolle auf „Kein Zugriff“ stellen, **Rechte setzen**: Die neue Kategorie „Website:
   Veröffentlicht · Website – Technik“ steht in der Erweiterung; die Rollen von Technik haben ihre Rechte; **die Rollen der Website** haben an der
   neuen Kategorie: Leiter lesen + schreiben, Mitarbeiter nur lesen – mit den Stufen, die sie vorher hatten (wer Redakteur war, bleibt es).
   Der Abschnitt zeigt jetzt keinen Hinweis „noch nicht eingerichtet“ mehr.
5. **Website-Stufen ändern entzieht nichts:** Bei der Gruppe „Website“ eine Stufe ändern und zurück, jeweils **Rechte setzen**: Die Rechte der
   Website-Rollen an 117 und an der Technik-Kategorie bleiben (bzw. folgen der Stufe); die Rechte der Rollen der Untergruppen bleiben unberührt.
6. **Leitung je Gruppe:** In „Entwürfe“ stehen jetzt Werte `website-leitung` – einer **ohne** `gruppe` (Website) und je Untergruppe einer mit
   `"gruppe": 347` bzw. der ID von Technik. Die Mails im Freigabe-Weg der Website (TF-WEBSITE-17) gehen weiter an die Leitung der Website.
7. **Hinweis weg:** Fenster schließen: Der Hinweis oben ist verschwunden.
8. **Als Spike (Mitarbeiter in 347):** Die Erweiterung öffnen: Er sieht **nur die Seiten von „Website – Jugend“** (seit W3b-4b – der Rest steht in
   TF-WEBSITE-19). Als **Leiter in 347** (Rolle per Werkzeug wechseln): Er gibt die Seiten von Jugend frei; in ChurchTools darf er in 117 schreiben.
9. **Nicht-Admin der Website-Leitung schreibt in 117** (in der Messung offen geblieben): Spike per Werkzeug als **Leiter in 344** – er darf in
   117 schreiben (z. B. über die API-Probe des Werkzeugs).

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/organigramm/gruppen.ts`, `shared/website/einrichten.ts`, `shared/website/rechte.ts`, `shared/website/mailWerte.ts`, `shared/website/zugang.ts`, `website/src/rechte.ts`, `website/src/WerDarfWas.tsx`, `website/src/RechteHinweis.tsx`, `website/src/leitungFehler.ts`, `website/src/demo.ts`
- **Automatisiert:** teilweise – `shared/organigramm/gruppen.test.ts` (direkte Kinder, Enkel nicht), `shared/website/einrichten.test.ts` (Untergruppen aus der Hierarchie, Website nur über `entwuerfe-g`, Untergruppen-Kategorien), `shared/website/rechte.test.ts` (Soll Website/Untergruppe, nie fremde Veröffentlicht-Kategorie, `verwaltetVon`, Stufen zum Nachziehen, Hinweise), `shared/website/mailWerte.test.ts` (Leitung je Gruppe, alter Wert ohne `gruppe`), `website/src/rechte.test.ts` (Ablauf einrichten → nachziehen, Kategorie wiederverwendet, Teilfehler), `website/src/WerDarfWas.test.tsx`, `website/src/App.test.tsx`, `website/src/demo.test.ts`; die echten Rechte in ChurchTools und Spikes Rollen nur in der Test-Instanz
- **Historie:** neu mit W3b-4a (23.11.2026)

</details>

### TF-WEBSITE-19 · Bereiche: Untergruppe sieht nur ihre Seiten, gibt ihre frei, Seite verschieben

**Das brauchst du:** Die Website in der Test-Instanz mit eingerichteter Untergruppe **„Website – Jugend“** (347, Kategorie 117, TF-WEBSITE-18),
Alwin als Leiter der Website (344), Spike nur in 347 (erst Mitarbeiter, dann Leiter – Rollen per Werkzeug, **nicht** „Person simulieren“). Zwei
Browser (Alwin, Spike). Vorher als Alwin zwei Seiten anlegen: **„Jugendabend“** und **„Freizeit 2027“**, beide veröffentlichen (sie liegen dann
in der Kategorie der Website).

**Das muss passieren:** Eine Seite gehört der Website oder einer Untergruppe (**Seite einstellen → Bereich**, nur die Leitung der Website).
Mitglieder einer Untergruppe sehen in „Seiten“ und „Freigaben“ nur die Seiten ihres Bereichs, die Vorschau zeigt aber Menü und Aussehen der ganzen
Website. Die Leitung der Untergruppe gibt ihre Seiten frei – in die Kategorie der Untergruppe. **Ändert die Leitung der Website den Bereich einer
Seite, die online steht, wandert die veröffentlichte Fassung sofort mit** (W3b-4b-2) – nur ihr Bereich ändert sich, ungeprüfte Änderungen im
Entwurf gehen nicht online; was dabei nicht gelingt, steht in der Meldung.

1. **Bereich ändern → sofort verschoben (Alwin):** „Jugendabend“ → **Seite einstellen**: Das Feld **Bereich** zeigt „Website“, „Website – Jugend“
   (keine nicht eingerichtete Untergruppe). „Website – Jugend“ wählen, **Fertig**. Oben „Gespeichert“, darunter die Meldung „„Jugendabend“ steht
   online jetzt im Bereich „Website – Jugend“.“; das Etikett zeigt **Online**. In ChurchTools (Werte der Erweiterung) steht die Seite jetzt in
   **117**, nicht mehr in „Veröffentlicht“ der Website (107). Unter **Freigaben** steht sie nicht.
2. **Die Online-Fassung wandert, nicht der Entwurf (Alwin):** In „Freizeit 2027“ einen Text ändern (**nicht** veröffentlichen), dann **Seite
   einstellen → Bereich** „Website – Jugend“, **Fertig**. Dieselbe Meldung; das Etikett zeigt **Geändert**. In 117 steht der **alte** Text (ohne die
   Änderung), in 107 nichts mehr. Unter **Freigaben** steht „Freizeit 2027“ als „Geändert“ mit „· Bereich „Website – Jugend““ (für Schritt 5).
3. **Als Spike, Mitarbeiter in 347:** Die Erweiterung zeigt nur „Jugendabend“ und „Freizeit 2027“ (keine Startseite, kein Impressum, „Im Menü“
   leer, kein Hinweis „Startseite anlegen“); kein Reiter Aussehen, kein Einstellungen. Die Vorschau zeigt Kopf und Menü der Website.
   **Neue Seite** mit dem Titel einer Website-Seite, die Spike nicht sieht (z. B. „Impressum“): Die Adresse wird `/impressum-2/`. Anlegen: Die
   Seite gehört zu Jugend (Alwin sieht sie in „Seite einstellen“ mit Bereich „Website – Jugend“). Sie **Zur Prüfung einreichen**.
4. **Als Alwin:** Unter **Freigaben** steht Spikes Seite als „Eingereicht“ mit „· Bereich „Website – Jugend““. (Mail: bis W3b-4c keine – Spike
   sieht die Leitung der Website nicht.) Noch **nicht** freigeben.
5. **Als Spike, Leiter in 347** (Rolle per Werkzeug, Erweiterung neu laden): Reiter **Freigaben** mit Zähler 1; die Liste zeigt nur Seiten von
   Jugend, **kein** Menü, **keine** Einstellungen. Spikes Seite **Freigeben** → online in 117. **„Freizeit 2027“ Veröffentlichen**: „„Freizeit 2027“
   ist online.“ – **ohne** Zusatz „steht zusätzlich noch online“: Sie steht nur in 117, jetzt mit der Änderung aus Schritt 2 (kein Doppel mehr wie
   bei der Abnahme am 25.11.2026).
6. **Zurück auf „Website“ (Alwin):** „Jugendabend“ → **Seite einstellen → Bereich** „Website“, **Fertig**: „„Jugendabend“ steht online jetzt im
   Bereich „Website“.“ – in 107, nicht mehr in 117; Etikett **Online**. Danach wieder auf „Website – Jugend“ stellen.
7. **Ohne Bereich:** Eine Person, die in „Entwürfe“ schreiben darf, aber weder in 344 noch in 347 ist (z. B. Spike kurz aus 347 nehmen, Rolle
   mit Rechten über eine andere Gruppe): Statt der Seiten steht „Du darfst an der Website mitarbeiten, bist aber in keiner ihrer Gruppen
   eingetragen …“. Danach Spike wieder in 347.
8. **Wer darf was (Abnahme W3b-4a):** Als Admin **Wer darf was** im Hinweis beim Start: Das Fenster springt zum Abschnitt „Wer darf was“. Mit
   VoiceOver o. Ä.: Die Auswahlfelder heißen „Stufe von Leiter in „Website““ bzw. „… in „Website – Jugend““.
9. **Handy:** Schritte 3 und 5 am Handy: Liste, Etiketten und Meldungen lesbar, nichts abgeschnitten.

<details><summary>Technisches</summary>

- **Priorität:** hoch
- **Betrifft:** `shared/website/modell.ts`, `shared/website/zugang.ts`, `shared/website/freigabe.ts`, `shared/website/einrichten.ts`, `website/src/start.ts`, `website/src/App.tsx`, `website/src/Seiten.tsx`, `website/src/Seitenarbeit.tsx`, `website/src/Freigaben.tsx`, `website/src/SeiteEinstellen.tsx`, `website/src/NeueSeite.tsx`, `website/src/daten.ts`, `website/src/freigabeAnzeige.ts`, `website/src/WerDarfWas.tsx`, `website/src/RollenStufen.tsx`, `website/src/demo.ts`
- **Automatisiert:** teilweise – `shared/website/zugang.test.ts` (alle Zweige des Zugangs, Website geht vor, ohne Bereich, Rechte je Bereich), `shared/website/freigabe.test.ts` (richtige Kategorie, nicht eingerichtet, Verschieben in der Reihenfolge, alt löschen scheitert, Entfernen aus allen Kategorien, Online-Vergleich mit falschem Bereich, Liste/Zähler je Bereich; Bereichswechsel: Online-Fassung statt Entwurf, nur `bereich` geändert, Reihenfolge, „danach Online“, Fehlerzweige einzeln), `website/src/start.test.ts` (Untergruppen, Mitgliedschaften, Lesefehler), `website/src/Seiten.bereiche.test.tsx` (auch: erst speichern, dann verschieben; Meldungen getrennt), `website/src/Freigaben.bereiche.test.tsx`, `website/src/Seitenarbeit.test.tsx` (Feld „Bereich“; Auslöser nur nach gelungenem Speichern, nie bei fremdem Stand), `website/src/App.test.tsx`, `website/src/WerDarfWas.test.tsx`, `website/src/demo.test.ts` (Demo-Fälle `jugend-redakteur`, `jugend-leitung`, `bereiche`); die echten Rechte in ChurchTools und Spikes Rollen nur in der Test-Instanz
- **Historie:** neu mit W3b-4b (23.11.2026); W3b-4b-2 (25.11.2026): Bereich ändern verschiebt sofort (Schritte 1, 2, 5, 6 neu)

</details>
