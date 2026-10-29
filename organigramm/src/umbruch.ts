/**
 * **Namen umbrechen und kürzen** (O7b-6) – EINE Regel für die Kästchen im Diagramm (Bildschirm, Präsentation, PDF) und
 * die Liste im PDF: Namen stehen mit Komma hintereinander und brechen nur nach einem Komma um, ein Name wird nie geteilt;
 * was allein nicht passt, endet mit „…“. Gemessen wird beim Aufrufer (`breite`), in seiner Schrift und Einheit.
 */
type Breite = (text: string) => number;

/** So viel vom Text, wie in `platz` passt – sonst mit „…“ gekürzt. */
export function kuerzenAuf(text: string, platz: number, breite: Breite): string {
  if (breite(text) <= platz) return text;
  let t = text;
  while (t.length > 1 && breite(t + '…') > platz) t = t.slice(0, -1);
  return t + '…';
}

/** Die Namen als Zeilen, die in `platz` passen – umgebrochen nach Kommas (das Komma bleibt am Zeilenende). */
export function nachKommasUmbrechen(
  namen: readonly string[],
  platz: number,
  breite: Breite,
): string[] {
  const zeilen: string[] = [];
  let akt = '';
  namen.forEach((n, i) => {
    const probe = akt ? `${akt}, ${n}` : n;
    // Das Komma am Zeilenende zählt mit – nach dem letzten Namen steht keins.
    const komma = i < namen.length - 1 ? ',' : '';
    if (akt && breite(probe + komma) > platz) {
      zeilen.push(akt + ',');
      akt = n;
    } else akt = probe;
  });
  if (akt) zeilen.push(akt);
  return zeilen.map((z) => kuerzenAuf(z, platz, breite));
}
