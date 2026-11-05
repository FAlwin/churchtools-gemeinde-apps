import type { jsPDF } from 'jspdf';
import type { PlanBlatt, PlanBlattAbschnitt } from '@shared/dienstplan/planBlatt';
import {
  GROSS,
  GRAU,
  neuesDokument,
  PdfSatz,
  PT,
  RAND,
  tabellenBreiten,
  zeilenHoehe,
  type Messen,
  type SpaltenRegel,
} from './pdfSatz';

/**
 * **Das Plan-Blatt als PDF** (Bauplan E8-2) – gezeichnet, was `shared/dienstplan/planBlatt.ts` festgelegt hat, mit dem
 * Satz des Termin-Blatts (`pdfSatz.ts`): derselbe Kopf und Fuß, je Gruppe eine Tabelle (beim ganzen Plan mit grauem
 * Band darüber), der Tabellenkopf wiederholt sich nach jedem Seitenumbruch, eine Zeile wird nie zerteilt, ein Band steht
 * nie allein unten.
 *
 * `schrift` nur für Tests („helvetica“): Mit eingebetteter Lato steht der Text nicht lesbar im PDF.
 */
export async function planBlattPdf(b: PlanBlatt, schrift?: string): Promise<jsPDF> {
  const { d, font } = await neuesDokument(b.quer, schrift);
  new PlanZeichner(d, font, b).alles();
  return d;
}

/**
 * Spaltenbreiten einer Plan-Tabelle: „Termin“ so breit wie nötig (höchstens 75 mm), den übrigen Platz teilen sich die
 * Dienste – sonst rückten sie weit nach rechts (Probe 05.11.2026).
 */
export function planSpalten(a: PlanBlattAbschnitt, innen: number, messen: Messen): number[] {
  const regeln: SpaltenRegel[] = a.kopf.map((_, k) =>
    k === 0 ? { min: 40, max: 75, ohneRest: true } : { min: 20, max: 55 },
  );
  return tabellenBreiten(a.kopf, a.zeilen, innen, messen, regeln);
}

class PlanZeichner extends PdfSatz {
  constructor(
    d: jsPDF,
    font: string,
    private readonly b: PlanBlatt,
  ) {
    super(d, font);
  }

  alles() {
    if (this.b.oben) this.text(this.b.oben);
    if (this.b.leer) this.text(this.b.leer);
    this.b.abschnitte.forEach((a, i) => {
      if (i > 0) this.y += 5;
      this.abschnitt(a);
    });
    this.kopfUndFuss(this.b);
  }

  /** Eine graue Zeile über der Tabelle (oder statt ihrer). */
  private text(t: string) {
    this.d.setFont(this.font, 'normal');
    this.d.setFontSize(GROSS + 0.5);
    this.d.setTextColor(...GRAU);
    const zeilen = this.d.splitTextToSize(t, this.innen) as string[];
    this.d.text(zeilen, RAND, this.y + GROSS * PT);
    this.y += zeilen.length * zeilenHoehe(GROSS + 0.5) + 3;
  }

  private abschnitt(a: PlanBlattAbschnitt) {
    const breiten = planSpalten(a, this.innen, this.messen);
    const xs = this.positionen(breiten);
    const hoehen = a.zeilen.map((z) => this.zeilenHoeheAus(z, breiten));
    const kopfHoehe = 4.8;
    const band = a.titel ? this.bandHoehe() : 0;
    // Band und Tabellenkopf nie allein unten – sie wandern mit der ersten Zeile.
    if (this.y + band + kopfHoehe + (hoehen[0] ?? 0) > this.unten) this.neueSeite();
    if (a.titel) {
      this.band(a.titel, null, band);
      this.y += band;
    }
    this.tabellenKopf(a.kopf, xs);
    a.zeilen.forEach((z, i) => {
      const h = hoehen[i];
      if (this.y + h > this.unten) {
        this.neueSeite();
        this.tabellenKopf(a.kopf, xs);
      }
      this.tabellenZeile(z, xs, breiten, h);
      this.y += h;
    });
  }
}
