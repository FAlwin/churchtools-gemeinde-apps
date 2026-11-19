/** Eine neue, zufällige Kennung für Seiten, Abschnitte, Spalten und Bausteine (höchstens 64 Zeichen im Modell). */
export function neueId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}
