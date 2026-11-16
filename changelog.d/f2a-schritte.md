### Intern

- **Anmeldungen: Formular in Schritten – Regel-Teil** (Etappe F, Scheibe F2a; noch nicht freigegeben, veröffentlicht
  wird erst nach Etappe F). Entwurf `f2-schritte-v1`, Klick-Runden 7 und 8 (16.11.2026). Noch ohne Oberfläche:
  - Neuer Feldtyp `schritt` (Baustein „Neuer Schritt“, kommt mit F2c in die Leiste): ein Text-Baustein ohne Spalte in
    ChurchTools, der Name ist Pflicht. Der Name von Schritt 1 steht in den Einstellungen (`ersterSchritt`, sonst
    „Deine Angaben“).
  - Hat ein Schritt eine Bedingung und ist sie nicht erfüllt, wird er übersprungen: Seine Felder sind nicht zu sehen –
    geregelt in `feldSichtbar` (`schrittVon`), also auch für Pflicht, Leeren vor dem Absenden und Nachprüfung. Preis
    und Datenschutz gehören zu keinem Schritt, sie stehen immer am Ende des letzten (`amEnde`, dafür aus `baukasten.ts`
    in den Regel-Baustein verlegt und dort weitergereicht).
  - `shared/anmeldung/formularSchritte.ts`: die Seiten des Formulars (`seiten`, `gezeigteSeiten`, `seiteSichtbar`),
    die Pflicht je Seite (`seiteFehlt` – die Pflichtprüfung des ganzen Formulars, eingegrenzt) und `schrittName`.
