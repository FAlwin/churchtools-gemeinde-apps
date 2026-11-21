### Neu (Musik-App + Dienstplaner)

- **Infos der Dienstgruppen direkt in der Zelle bearbeiten.** Im Bearbeiten-Modus bleiben die gewählten Info-Spalten (z. B. Technik) am Rechner und iPad **stehen wie in der Ansicht** – statt einer Zeile unter dem Eintrag. Eine Zelle anklicken öffnet ein Textfeld in der Zelle; **gespeichert wird beim Verlassen** (nur bei Änderung), **Esc verwirft**. Schlägt das Speichern fehl, geht die Zelle mit dem eingegebenen Text wieder auf und nennt den Fehler; hat inzwischen jemand anderes dieselbe Info geändert, speichert das nächste Verlassen trotzdem (wie „Trotzdem speichern“ im Punkt-Fenster). Ist der Ablauf abgeschlossen, zeigt ein Klick den Sperr-Hinweis. Am Handy und in der Matrix bleibt es, wie es war (Zeile unter dem Punkt bzw. keine Infos; geändert wird im Punkt-Fenster). Gilt auch für Ablaufvorlagen. Die Einführung des Bearbeitens (Musik-App) hat dafür einen Schritt „Infos je Gruppe“ und startet einmal neu (`setlist-edit-v9`).

### Intern (Musik-App + Dienstplaner)

- Die Info-Tabelle (Raster, Kopfzeile, Spaltenbreiten, waagerechtes Scrollen) ist ein gemeinsamer Baustein (`ui/ablauf/InfoTabelle.tsx` + `infoTabellenRegeln.ts`) für Ansicht und Bearbeiten-Liste; vorher stand die Rechnung nur in `AblaufListe`. Das Bearbeiten spiegelt geänderte Infos jetzt sofort in der Liste (`infosErsetzt`) – das nützt auch dem Punkt-Fenster.
