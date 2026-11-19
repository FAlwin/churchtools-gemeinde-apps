import type { jsPDF } from 'jspdf';
import type { PlanBlatt, PlanBlattAbschnitt } from '@shared/dienstplan/planBlatt';
import {
  GROSS,
  GRAU,
  INHALT_OBEN,
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
 * nie allein unten. „Je Person“ (E8-4c): ein Abschnitt je Person mit dem Namen im Band; er beginnt auf einer neuen Seite
 * (`neueSeite`) oder wandert ganz auf die nächste, wenn er nicht mehr auf die Seite passt (`zusammen`) – nur ein Abschnitt,
 * der allein länger als eine Seite ist, wird getrennt (der Tabellenkopf wiederholt sich).
 *
 * `schrift` nur für Tests („helvetica“): Mit eingebetteter PDF-Schrift steht der Text nicht lesbar im PDF.
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
  // „Personen × Termine“: Name und Summe so breit wie nötig (der Name höchstens 60 mm) – auch wenn es eng wird, sonst
  // bekäme der Name nur den gleichen Anteil wie ein Termin und bräche mitten im Wort um (Probe 19.11.2026).
  // Den Platz teilen sich die Termine.
  const regeln: SpaltenRegel[] = a.kopf.map((_, k): SpaltenRegel => {
    // „Je Person“: Datum und Uhrzeit so breit wie nötig, den Rest teilen sich Termin und Dienst (der Dienst darf umbrechen).
    if (a.person)
      return k < 2 ? { fest: true } : k === 2 ? { min: 20, max: 75 } : { min: 30, max: 90 };
    if (a.personen)
      return k === 0
        ? { fest: true, max: 60 }
        : k === a.kopf.length - 1
          ? { fest: true }
          : { min: 20, max: 55 };
    return k === 0 ? { min: 40, max: 75, ohneRest: true } : { min: 20, max: 55 };
  });
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
    if (this.b.leer) this.text(this.b.leer);
    this.b.abschnitte.forEach((a, i) => {
      if (i > 0) this.y += 5;
      this.abschnitt(a);
    });
    this.kopfUndFuss(this.b);
  }

  /** Eine graue Zeile statt der Tabelle. */
  private text(t: string) {
    this.d.setFont(this.font, 'normal');
    this.d.setFontSize(GROSS + 0.5);
    this.d.setTextColor(...GRAU);
    const zeilen = this.d.splitTextToSize(t, this.innen) as string[];
    this.d.text(zeilen, RAND, this.y + GROSS * PT);
    this.y += zeilen.length * zeilenHoehe(GROSS + 0.5) + 3;
  }

  /**
   * „Je Person“: alle Abschnitte teilen sich dieselben Spaltenbreiten (gerechnet über alle Zeilen), sonst säße die
   * Dienst-Spalte bei jeder Person woanders und die Seite sähe ausgefranst aus (Probe 19.11.2026).
   */
  private personBreiten?: number[];

  private abschnitt(a: PlanBlattAbschnitt) {
    let breiten: number[];
    if (a.person) {
      this.personBreiten ??= planSpalten(
        { ...a, zeilen: this.b.abschnitte.filter((x) => x.person).flatMap((x) => x.zeilen) },
        this.innen,
        this.messen,
      );
      breiten = this.personBreiten;
    } else breiten = planSpalten(a, this.innen, this.messen);
    const xs = this.positionen(breiten);
    const hoehen = a.zeilen.map((z) => this.zeilenHoeheAus(z, breiten));
    const kopfHoehe = 4.8;
    const band = a.titel ? this.bandHoehe() : 0;
    const gesamt = band + kopfHoehe + hoehen.reduce((s, h) => s + h, 0);
    if (a.neueSeite) this.neueSeite();
    // Zusammenhalten: passt der Abschnitt auf eine Seite, aber nicht mehr hierher, geht er ganz auf die nächste.
    else if (a.zusammen && gesamt <= this.unten - INHALT_OBEN && this.y + gesamt > this.unten)
      this.neueSeite();
    // Band und Tabellenkopf nie allein unten – sie wandern mit der ersten Zeile.
    else if (this.y + band + kopfHoehe + (hoehen[0] ?? 0) > this.unten) this.neueSeite();
    if (a.titel) {
      this.band(a.titel, a.zusatz ?? null, band);
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
