### Neu (Website)

- **Reiter „Aussehen“ (W3a-3a).** Links das Formular, rechts die Vorschau der Startseite (eine andere Seite ist wählbar; am Handy untereinander). **Farben:** sechs Felder (Hauptfarbe, Hauptfarbe dunkel, Akzent, Hintergrund, Sanft, Text) mit Farbwähler und Hex-Eingabe – ein ungültiger Wert wird nicht übernommen. Ist Text auf dem Hintergrund oder auf „Sanft“ schwer lesbar (unter 4,5 : 1), steht ein ruhiger Hinweis an der Farbe; gespeichert werden kann trotzdem. **Schriften:** Text, Überschriften und die Handschrift-Zeile aus einer nach Art gruppierten Auswahl (14 freie Schriften); „Eigene Schrift“ erklärt, dass das mit dem Hochladen der Bilder kommt. **Logo:** das vorhandene wird genannt, ändern geht später mit den Bildern. **Eigenes CSS:** Textfeld mit Zeichenzähler, die Vorschau folgt kurz verzögert.
- **Die Vorschau zeigt jetzt die gewählten Schriften** – auch im Reiter „Seiten“. Es werden nur die Schriften geladen, die gerade gewählt sind (nicht alle 14); bis eine Schrift da ist, zeigt die Vorschau die Ersatzschrift. Lässt sich eine Schrift einmal nicht laden, steht ein leiser Hinweis mit „Erneut laden“; die Einstellungen bleiben unverändert.
- **Gespeichert wird von selbst**, kurz nach der letzten Änderung, mit demselben Ablauf wie bei den Seiten: eine Person bearbeitet, die anderen sehen zu („Das Aussehen bearbeitet gerade …“, „Bearbeitung übernehmen“, „Hier weiterbearbeiten“), „Speichert … / Gespeichert / Nicht gespeichert“ und „Erneut versuchen“. Hat jemand das Aussehen inzwischen geändert, wird nicht darüber geschrieben. Lassen sich die gespeicherten Einstellungen nicht lesen, bleiben sie unberührt und der Reiter bietet nichts zum Ändern an.
- Die Schriftdateien (14 Stück, nur Latin, mit ihren Lizenztexten) liegen in `shared/website/schriften/`. Roboto Slab steht unter Apache 2.0, alle anderen unter der SIL Open Font License.
- Der Demo-Modus (`?demo=seiten`) hat gespeicherte Einstellungen (Farben, Quicksand und Caveat Brush) und den neuen Fall `?demo=aussehen-gesperrt`.

### Behoben (Website)

- Eine eingebettete Schrift (`data:font/woff2;base64,…`) wäre im fertigen Stylesheet unbrauchbar geworden: Beim Absichern der Adresse wurde das Semikolon zu `%3B` und die Adresse damit keine Base64-Adresse mehr. Genau diese eine Form bleibt jetzt unverändert (strikt geprüft: nur Base64-Zeichen); alles andere wird wie bisher entschärft.

### Intern (Website)

- Sperre, Speicher-Schlange und „Übernehmen/Neu laden“ stehen jetzt einmal im Ablauf `useSperrarbeit` (`website/src/useSperrarbeit.ts`, Bänder in `SperrBaender.tsx`, Worte in `sperrTexte.ts`); Seiten und Aussehen nutzen ihn. Verhalten der Seiten unverändert. Beim Verlassen des Reiters mit noch laufendem Speichern wird die Sperre erst nach dem Speichern freigegeben.
- Die Sperre nimmt ein Ziel (Seite oder Einstellungen); `websiteAusWerten` liefert `einstellungenSperre`; `einstellungenSpeichern` prüft wie `seiteSpeichern` vorher mit dem Schema. `kontrast(a, b)` (WCAG) in `shared/website/theme.ts`, die Regeln des Reiters in `shared/website/aussehen.ts`.
- Schriften als nachgeladene Bündel-Teile (`import.meta.glob` mit `?inline`, `website/src/schriftLader.ts`); Wächter `shared/website/schriftdateien.test.ts` (Liste, Dateien, WOFF2-Kennung, Größe, `QUELLEN.md`, Lizenzen) und Tabellen-Wächter in `schriftLader.test.ts`.
- Testfall TF-WEBSITE-10.
