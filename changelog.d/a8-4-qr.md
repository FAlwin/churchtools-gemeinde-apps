### Neu (Anmeldungen, A8-4)

- **QR-Code und Aushang** – vierter Knopf „QR-Code“ in der Karte „Anmeldelink“ (Alwin, 23.10.2026): QR-Code zum Link,
  „QR-Code als Bild“ (PNG zum Teilen) und „Aushang als PDF“ (A4: Gemeinde, Titel, Termin, QR-Code, Link,
  Anmeldeschluss in Ortszeit). Gegenprobe: Der QR-Code auf dem gerenderten Aushang wird vom QR-Leser von macOS als
  genau dieser Link gelesen.
- Neuer Baustein `ui/teilen/qr.ts` (Muster über `qrcode-generator`, MIT, ohne weitere Abhängigkeiten; gezeichnet als
  SVG, PNG und direkt ins PDF).
- Die Terminzeile („Sa, 21.11.2026 · Gemeindehaus“) liegt jetzt in `shared/anmeldung/termin.ts` – Formular und Aushang
  nutzen dieselbe; die eigene Datumsfunktion des Formulars (Kopie von `datumText`) ist weg.
