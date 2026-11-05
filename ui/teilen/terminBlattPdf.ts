import type { jsPDF } from 'jspdf';
import type { BlattGruppe, BlattZeile, TerminBlatt, Zelle } from '@shared/ct/terminBlatt';
import {
  GROSS,
  INHALT_OBEN,
  KLEIN,
  KOPF,
  LINIE,
  NAVY,
  neuesDokument,
  PdfSatz,
  POLSTER_X,
  POLSTER_Y,
  PT,
  RAND,
  tabellenBreiten,
  TINTE,
  WEISS,
  type Messen,
  type SpaltenRegel,
} from './pdfSatz';

export type { Messen } from './pdfSatz';

/**
 * **Das Termin-Blatt als PDF** (Bauplan E8-1, Entwurf `e8-teilen.html` Version 5) – gezeichnet, was
 * `shared/ct/terminBlatt.ts` festgelegt hat: im ChurchTools-Look mit Lato, oben Titel und Datum groß, rechts Gemeinde und
 * Stand; die Dienste je Gruppe in Spalten (Dienst grau, Person fett); der Ablauf als Tabelle mit Abschnitten als graue
 * Bänder, Beginn und Ende als dunkle Bänder. Auf jeder Seite Kopf und „Seite x von y“, der Tabellenkopf wiederholt sich,
 * eine Zeile wird nie zerteilt, ein Abschnitt steht nie allein unten. Schrift, Zellen, Kopf und Fuß: `pdfSatz.ts`.
 *
 * `schrift` nur für Tests („helvetica“): Mit eingebetteter Lato steht der Text nicht lesbar im PDF.
 */
export async function terminBlattPdf(b: TerminBlatt, schrift?: string): Promise<jsPDF> {
  const { d, font } = await neuesDokument(b.quer, schrift);
  new Zeichner(d, font, b).alles();
  return d;
}

/**
 * **Spaltenbreiten des Ablaufs** (mm): Zeit und Dauer so breit wie ihr längster Wert – sie brechen nie um („09:00“ in zwei
 * Zeilen machte jede Zeile doppelt hoch, Probe 05.11.2026) –, der Rest nach Bedarf, übriger Platz an „Eintrag“.
 */
export function ablaufSpalten(
  a: NonNullable<TerminBlatt['ablauf']>,
  innen: number,
  messen: Messen,
): number[] {
  const zellen = a.zeilen.flatMap((z) => (z.art === 'eintrag' ? [z.zellen] : []));
  const regeln: SpaltenRegel[] = a.arten.map((art) =>
    art === 'zeit' || art === 'dauer'
      ? { fest: true }
      : art === 'eintrag'
        ? { min: 45, max: 95, rest: true }
        : { min: 18, max: 60 },
  );
  return tabellenBreiten(a.kopf, zellen, innen, messen, regeln);
}

class Zeichner extends PdfSatz {
  private spaltenX: number[] = [];
  private spaltenB: number[] = [];

  constructor(
    d: jsPDF,
    font: string,
    private readonly b: TerminBlatt,
  ) {
    super(d, font);
  }

  alles() {
    if (this.b.dienste && !this.b.diensteUnten) this.dienste(this.b.dienste);
    if (this.b.ablauf) this.ablauf();
    if (this.b.dienste && this.b.diensteUnten) {
      if (this.b.ablauf) this.y += 5;
      this.dienste(this.b.dienste);
    }
    this.kopfUndFuss(this.b);
  }

  // ── Dienste ────────────────────────────────────────────────────────────────

  private dienste(gruppen: BlattGruppe[]) {
    if (gruppen.length === 0) return;
    const proReihe = this.b.quer ? 4 : 3;
    const abstand = 6;
    const sb = (this.innen - (proReihe - 1) * abstand) / proReihe;
    for (let i = 0; i < gruppen.length; i += proReihe) {
      const reihe = gruppen.slice(i, i + proReihe).map((g) => this.gruppenMass(g, sb));
      const h = Math.max(...reihe.map((r) => r.hoehe));
      if (this.y + h > this.unten && this.y > INHALT_OBEN) this.neueSeite();
      reihe.forEach((r, k) => this.gruppe(r, RAND + k * (sb + abstand), this.y, sb));
      this.y += h + 4;
    }
    this.y += 1;
  }

  private gruppenMass(g: BlattGruppe, sb: number) {
    const links = Math.min(
      sb * 0.45,
      Math.max(...g.dienste.map((d) => this.textBreite(d.name, 'grau', KLEIN))) + 3,
    );
    const rechts = sb - links;
    const zeilen = g.dienste.map((d) => {
      const wer: Zelle = {
        absaetze: [
          ...d.personen.map((p) => ({
            laeufe: [
              { text: p.name, stil: 'fett' as const },
              ...(p.angefragt ? [{ text: ' angefragt', stil: 'grau' as const }] : []),
            ],
          })),
          ...(d.frei > 0
            ? [{ laeufe: [{ text: d.frei > 1 ? `${d.frei} frei` : 'frei', stil: 'rot' as const }] }]
            : []),
        ],
      };
      const was: Zelle = { absaetze: [{ laeufe: [{ text: d.name, stil: 'grau' }], klein: true }] };
      const h = Math.max(this.zelleHoehe(was, links - 1), this.zelleHoehe(wer, rechts)) + 2 * 0.8;
      return { was, wer, h };
    });
    const kopf = 4.6;
    return { g, links, rechts, zeilen, kopf, hoehe: kopf + zeilen.reduce((s, z) => s + z.h, 0) };
  }

  private gruppe(r: ReturnType<Zeichner['gruppenMass']>, x: number, oben: number, sb: number) {
    this.d.setFont(this.font, 'bold');
    this.d.setFontSize(KOPF);
    this.d.setTextColor(...NAVY);
    this.d.text(r.g.name.toUpperCase(), x, oben + 2.6, { charSpace: 0.25 });
    this.linie(oben + 3.6, NAVY, 0.3, x, x + sb);
    let y = oben + r.kopf;
    for (const z of r.zeilen) {
      this.zelle(z.was, x, y + 0.8 + (GROSS - KLEIN) * PT * 0.5, r.links - 1);
      this.zelle(z.wer, x + r.links, y + 0.8, r.rechts);
      y += z.h;
      this.linie(y, LINIE, 0.15, x, x + sb);
    }
  }

  // ── Ablauf ─────────────────────────────────────────────────────────────────

  private ablauf() {
    const a = this.b.ablauf!;
    this.spaltenB = ablaufSpalten(a, this.innen, this.messen);
    this.spaltenX = this.positionen(this.spaltenB);
    if (this.y + 20 > this.unten) this.neueSeite();
    this.tabellenKopf(a.kopf, this.spaltenX);
    a.zeilen.forEach((z, i) => {
      const h = this.reihenHoehe(z);
      // Abschnitt und Beginn wandern mit der nächsten Zeile – allein unten auf der Seite helfen sie niemandem; „Ende“
      // nimmt den letzten Eintrag mit, statt allein oben auf einer neuen Seite zu stehen.
      const folgt = a.zeilen[i + 1];
      const naechste =
        z.art === 'abschnitt' || z.art === 'beginn' || folgt?.art === 'ende'
          ? this.reihenHoeheBei(i + 1)
          : 0;
      if (this.y + h + naechste > this.unten) {
        this.neueSeite();
        this.tabellenKopf(a.kopf, this.spaltenX);
      }
      this.zeile(z, h);
      this.y += h;
    });
  }

  private reihenHoeheBei(i: number) {
    const z = this.b.ablauf!.zeilen[i];
    return z ? this.reihenHoehe(z) : 0;
  }

  private reihenHoehe(z: BlattZeile) {
    if (z.art !== 'eintrag') return this.bandHoehe();
    return this.zeilenHoeheAus(z.zellen, this.spaltenB);
  }

  private zeile(z: BlattZeile, h: number) {
    const a = this.b.ablauf!;
    if (z.art === 'eintrag') {
      this.tabellenZeile(z.zellen, this.spaltenX, this.spaltenB, h, z.vorlauf);
      return;
    }
    if (z.art === 'abschnitt') {
      this.band(z.titel, z.dauer, h);
      return;
    }
    // Beginn und Ende: dunkle Bänder, die Uhrzeit in der Spalte „Zeit“.
    const grund = this.y + POLSTER_Y + 0.3 + GROSS * PT * 0.95;
    this.d.setFillColor(...NAVY);
    this.d.rect(RAND, this.y + 0.3, this.innen, h - 0.3, 'F');
    this.d.setFont(this.font, 'bold');
    this.d.setFontSize(GROSS + 0.8);
    this.d.setTextColor(...WEISS);
    const mitZeit = a.arten[0] === 'zeit';
    const textX = (mitZeit ? this.spaltenX[a.arten.indexOf('eintrag')] : RAND) + POLSTER_X;
    const wort = z.art === 'beginn' ? 'Beginn' : 'Ende';
    if (mitZeit) this.d.text(z.zeit, this.spaltenX[0] + POLSTER_X, grund);
    this.d.text(mitZeit ? wort : `${wort} ${z.zeit}`, mitZeit ? textX : RAND + POLSTER_X, grund);
    if (z.art === 'ende' && z.dauer) {
      this.d.setFont(this.font, 'normal');
      this.d.setFontSize(KLEIN);
      this.d.text(z.dauer, RAND + this.innen - POLSTER_X, grund, { align: 'right' });
    }
    this.d.setTextColor(...TINTE);
  }
}
