/**
 * **Was auf dem Konto fehlt, darf auf dem Gerät nicht stehen bleiben** – für den Abgleich von
 * Anmerkungen und Lied-Einstellungen (Ablage in ChurchTools, 09.10.2026).
 *
 * Der Abgleich übernahm nur, was das Konto liefert. Eine Seite, die auf einem anderen Gerät (oder in der
 * Erweiterung) GANZ geleert wurde, fehlt in der Antwort – und blieb hier als alte Kopie sichtbar. Ebenso
 * eine anderswo zurückgesetzte Einstellung. Seit App und Erweiterung dieselbe Ablage teilen, fällt das auf.
 *
 * Entfernt wird nur, was **alles** zugleich gilt – sonst ginge Ungesichertes verloren:
 *  - der Eintrag gehört zu einem der abgefragten Lieder (über die anderen sagt die Antwort nichts);
 *  - das Konto kennt ihn nicht;
 *  - er wartet nicht auf das Hochladen (`geschuetzt`: Warteschlange, laufender Upload, Merker #256/#275);
 *  - das Gerät hat seinen alten Bestand schon einmal aufs Konto übertragen (`freigegeben`) – vorher
 *    wäre „fehlt auf dem Konto" der Normalfall und kein Löschen.
 *
 * Für beide Abgleiche EINE Regel, weil eine zweite Fassung genau hier auseinanderliefe.
 */
export function verwaisteEntfernen(o: {
  /** Gehört dieser localStorage-Schlüssel zu diesem Abgleich? Dann sein Konto-Schlüssel, sonst `null`. */
  kontoSchluessel: (lsKey: string) => string | null;
  liedVon: (kontoSchluessel: string) => number | null;
  songIds: number[];
  aufDemKonto: (kontoSchluessel: string) => boolean;
  geschuetzt: (kontoSchluessel: string) => boolean;
  freigegeben: boolean;
}): number {
  if (!o.freigegeben) return 0;
  const ids = new Set(o.songIds);
  const weg: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const ls = localStorage.key(i);
    if (!ls) continue;
    const key = o.kontoSchluessel(ls);
    if (key === null) continue;
    const lied = o.liedVon(key);
    if (lied === null || !ids.has(lied)) continue;
    if (o.aufDemKonto(key) || o.geschuetzt(key)) continue;
    weg.push(ls);
  }
  // Erst sammeln, dann löschen – sonst verschieben sich die Indizes beim Durchlaufen.
  for (const ls of weg) localStorage.removeItem(ls);
  return weg.length;
}
