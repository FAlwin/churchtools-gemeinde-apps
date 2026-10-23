import type { jsPDF } from 'jspdf';

/**
 * **Eine Liste als PDF** (A8, Entwurf `a8-druckliste-v1`, abgenommen 23.10.2026) – für jede App, die eine Tabelle
 * aufs Papier bringt. Auf **jeder** Seite: oben Titel (Gemeinde · Veranstaltung) und Name der Liste, unten der Stand
 * und „Seite x von y“ (Bauplan A8: „Stand-Datum auf jeder Seite“). Der Tabellenkopf wiederholt sich nach jedem
 * Seitenumbruch, eine Zeile wird nie zerteilt.
 *
 * Schrift Helvetica wie im Liedblatt (`chordPdf.ts`) – sie kann Umlaute und ß, aber keine Emoji.
 */

/** Eine Zeile – oder eine Zwischenüberschrift (z. B. „Warteliste“). */
export type ListenZeile = { zellen: string[] } | { abschnitt: string };

export interface ListenBlatt {
  /** Links oben, fett: „ECG Donrath · Kinderfreizeit“. */
  titel: string;
  /** Rechts oben: „Teilnehmer“. */
  liste: string;
  /** Links unten: „Stand 23.10.2026, 10:15“. */
  stand: string;
  kopf: string[];
  zeilen: ListenZeile[];
  /** Fett über der Tabelle, nur auf der ersten Seite – z. B. die Zahlen für die Küche. */
  oben?: string;
  /** Fett unter der Tabelle. */
  summe?: string;
}

// A4 in mm.
const RAND = 14;
const SCHRIFT = 9.5;
const ZEILE = 4.4;
const POLSTER = 1.6;
const KOPF_UNTEN = RAND + 10;
const FUSS = 9;
/** Ab so vielen Spalten wird quer gedruckt – sonst bleibt für jede Spalte zu wenig. */
const QUER_AB = 6;

/**
 * **Spaltenbreiten:** Jede Spalte bekommt, was ihr längster Text braucht. Ist das zu viel, bekommen die schmalen
 * Spalten ihr Maß und die breiten teilen sich den Rest (und brechen um); bleibt Platz, wird er gleichmäßig verteilt.
 */
export function spaltenBreiten(bedarf: number[], verfuegbar: number): number[] {
  const summe = bedarf.reduce((a, b) => a + b, 0);
  if (summe <= verfuegbar) {
    const dazu = (verfuegbar - summe) / bedarf.length;
    return bedarf.map((b) => b + dazu);
  }
  const breiten: (number | null)[] = bedarf.map(() => null);
  let rest = verfuegbar;
  let offen = bedarf.length;
  for (let geaendert = true; geaendert && offen > 0; ) {
    geaendert = false;
    const anteil = rest / offen;
    for (const [i, b] of bedarf.entries()) {
      if (breiten[i] === null && b <= anteil) {
        breiten[i] = b;
        rest -= b;
        offen--;
        geaendert = true;
      }
    }
  }
  const anteil = offen > 0 ? rest / offen : 0;
  return breiten.map((b) => b ?? anteil);
}

/** Baut das PDF. jsPDF wird erst hier geladen – die Erweiterung startet ohne den Brocken. */
export async function listenPdf(b: ListenBlatt): Promise<jsPDF> {
  const { jsPDF } = await import('jspdf');
  const quer = b.kopf.length >= QUER_AB;
  const d = new jsPDF({ unit: 'mm', format: 'a4', orientation: quer ? 'landscape' : 'portrait' });
  const breite = d.internal.pageSize.getWidth();
  const hoehe = d.internal.pageSize.getHeight();
  const innen = breite - 2 * RAND;
  const unten = hoehe - RAND - FUSS;

  d.setFontSize(SCHRIFT);
  const textBreite = (t: string, fett: boolean) => {
    d.setFont('helvetica', fett ? 'bold' : 'normal');
    return Math.max(0, ...t.split('\n').map((z) => d.getTextWidth(z)));
  };
  const bedarf = b.kopf.map(
    (k, i) =>
      Math.max(
        textBreite(k, true),
        ...b.zeilen.map((z) => ('zellen' in z ? textBreite(z.zellen[i] ?? '', false) : 0)),
      ) +
      2 * POLSTER,
  );
  const breiten = spaltenBreiten(bedarf, innen);
  const xs = breiten.map((_, i) => RAND + breiten.slice(0, i).reduce((a, w) => a + w, 0));

  const umbrechen = (zellen: string[], fett: boolean) => {
    d.setFont('helvetica', fett ? 'bold' : 'normal');
    return zellen.map((t, i) => d.splitTextToSize(t ?? '', breiten[i] - 2 * POLSTER) as string[]);
  };
  const zeichneZeile = (zeilen: string[][], y: number, fett: boolean) => {
    d.setFont('helvetica', fett ? 'bold' : 'normal');
    zeilen.forEach((t, i) =>
      d.text(t, xs[i] + POLSTER, y + POLSTER + 3.2, { lineHeightFactor: 1.2 }),
    );
    const h = Math.max(1, ...zeilen.map((t) => t.length)) * ZEILE + 2 * POLSTER;
    return h;
  };

  let y = 0;
  const tabellenKopf = () => {
    const h = zeichneZeile(umbrechen(b.kopf, true), y, true);
    y += h;
    d.setLineWidth(0.35);
    d.line(RAND, y, RAND + innen, y);
  };
  const neueSeite = (erste: boolean) => {
    if (!erste) d.addPage();
    y = KOPF_UNTEN + 3;
    if (erste && b.oben) {
      d.setFont('helvetica', 'bold');
      d.text(b.oben, RAND + POLSTER, y + 4);
      y += 9;
    }
    tabellenKopf();
  };

  neueSeite(true);
  for (const z of b.zeilen) {
    if ('abschnitt' in z) {
      // Eine Überschrift allein unten auf der Seite hilft niemandem – sie wandert mit der nächsten Zeile.
      if (y + 2 * (ZEILE + 2 * POLSTER) + 3 > unten) neueSeite(false);
      y += 3;
      y += zeichneZeile([[z.abschnitt]], y, true);
      continue;
    }
    const teile = umbrechen(z.zellen, false);
    const h = Math.max(1, ...teile.map((t) => t.length)) * ZEILE + 2 * POLSTER;
    if (y + h > unten) neueSeite(false);
    zeichneZeile(teile, y, false);
    y += h;
    d.setLineWidth(0.1);
    d.setDrawColor(190);
    d.line(RAND, y, RAND + innen, y);
    d.setDrawColor(0);
  }
  if (b.summe) {
    if (y + ZEILE + 4 > unten) neueSeite(false);
    d.setFont('helvetica', 'bold');
    d.text(b.summe, RAND + POLSTER, y + 6);
  }

  // Kopf und Fuß zuletzt – erst jetzt steht fest, wie viele Seiten es sind.
  const seiten = d.getNumberOfPages();
  for (let s = 1; s <= seiten; s++) {
    d.setPage(s);
    d.setFontSize(11);
    d.setFont('helvetica', 'bold');
    // Ein zu langer Titel wird gekürzt, nicht umbrochen – er soll den Namen der Liste nicht überdecken.
    const titelZeilen = d.splitTextToSize(b.titel, innen * 0.7) as string[];
    d.text(titelZeilen[0] ?? '', RAND, RAND + 5);
    d.setFont('helvetica', 'normal');
    d.setFontSize(SCHRIFT);
    d.text(b.liste, breite - RAND, RAND + 5, { align: 'right' });
    d.setLineWidth(0.5);
    d.line(RAND, RAND + 7.5, breite - RAND, RAND + 7.5);
    d.setFontSize(8);
    d.setTextColor(110);
    d.text(b.stand, RAND, hoehe - RAND);
    d.text(`Seite ${s} von ${seiten}`, breite - RAND, hoehe - RAND, { align: 'right' });
    d.setTextColor(0);
  }
  return d;
}
