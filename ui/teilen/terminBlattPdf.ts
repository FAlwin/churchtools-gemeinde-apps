import type { jsPDF } from 'jspdf';
import type {
  Absatz,
  BlattGruppe,
  BlattZeile,
  Lauf,
  TerminBlatt,
  Zelle,
} from '@shared/ct/terminBlatt';
import { spaltenBreiten } from './listenPdf';

/**
 * **Das Termin-Blatt als PDF** (Bauplan E8-1, Entwurf `e8-teilen.html` Version 5) – gezeichnet, was
 * `shared/ct/terminBlatt.ts` festgelegt hat: im ChurchTools-Look mit Lato (`pdfSchrift.ts`), oben Titel und Datum groß,
 * rechts Gemeinde und Stand; die Dienste je Gruppe in Spalten (Dienst grau, Person fett); der Ablauf als Tabelle mit
 * Abschnitten als graue Bänder, Beginn und Ende als dunkle Bänder. Auf jeder Seite Kopf und „Seite x von y“, der
 * Tabellenkopf wiederholt sich, eine Zeile wird nie zerteilt, ein Abschnitt steht nie allein unten.
 *
 * `schrift` nur für Tests („helvetica“): Mit eingebetteter Lato steht der Text nicht lesbar im PDF.
 */
export async function terminBlattPdf(b: TerminBlatt, schrift?: string): Promise<jsPDF> {
  const { jsPDF } = await import('jspdf');
  const d = new jsPDF({ unit: 'mm', format: 'a4', orientation: b.quer ? 'landscape' : 'portrait' });
  let font = schrift;
  if (!font) {
    const { latoEinbetten, PDF_SCHRIFT } = await import('./pdfSchrift');
    latoEinbetten(d);
    font = PDF_SCHRIFT;
  }
  new Zeichner(d, font, b).alles();
  return d;
}

// mm, Schriftgrößen in pt.
const RAND = 14;
const INHALT_OBEN = RAND + 19;
const FUSS = 8;
const GROSS = 9;
const KLEIN = 7.8;
const KOPF = 6.8;
const PT = 0.3528;
const POLSTER_X = 1.5;
const POLSTER_Y = 1.3;
const ABSATZ = 0.5;

type Farbe = [number, number, number];
const NAVY: Farbe = [29, 41, 61];
const TINTE: Farbe = [15, 23, 43];
const GRAU: Farbe = [91, 107, 128];
const HELLGRAU: Farbe = [138, 153, 173];
const LINIE: Farbe = [221, 227, 234];
const BAND: Farbe = [238, 242, 246];
const SCHILD: Farbe = [232, 238, 246];
const ROT: Farbe = [231, 0, 11];
const WEISS: Farbe = [255, 255, 255];

const zeilenHoehe = (pt: number) => pt * PT * 1.3;

/** Misst einen Text in mm – in der Zeichnung mit jsPDF, im Test mit festen Breiten. */
export type Messen = (text: string, stil: Lauf['stil'], pt: number) => number;

/**
 * **Spaltenbreiten des Ablaufs** (mm): Zeit und Dauer so breit wie ihr längster Wert – sie brechen nie um („09:00“ in zwei
 * Zeilen machte jede Zeile doppelt hoch, Probe 05.11.2026) –, der Rest nach Bedarf (`spaltenBreiten`), übriger Platz an
 * „Eintrag“.
 */
export function ablaufSpalten(
  a: NonNullable<TerminBlatt['ablauf']>,
  innen: number,
  messen: Messen,
): number[] {
  const zellen = a.zeilen.flatMap((z) => (z.art === 'eintrag' ? [z.zellen] : []));
  const natur = (k: number) =>
    Math.max(
      messen(a.kopf[k].toUpperCase(), 'fett', KOPF),
      ...zellen.map((c) =>
        Math.max(
          0,
          ...c[k].absaetze.map((p) =>
            p.laeufe.reduce(
              (s, l) =>
                s +
                messen(l.text, l.stil, p.klein ? KLEIN : GROSS) +
                (l.stil === 'schild' ? 3.2 : 0),
              0,
            ),
          ),
        ),
      ),
    ) +
    2 * POLSTER_X;
  const fest = a.arten.map((art, k) => (art === 'zeit' || art === 'dauer' ? natur(k) + 0.5 : null));
  const bedarf = a.arten.map((art, k) => {
    const f = fest[k];
    if (f !== null) return f;
    const max = art === 'eintrag' ? 95 : 60;
    return Math.min(max, Math.max(art === 'eintrag' ? 45 : 18, natur(k)));
  });
  const summe = bedarf.reduce((s, x) => s + x, 0);
  const iEintrag = a.arten.indexOf('eintrag');
  if (summe <= innen) return bedarf.map((x, k) => (k === iEintrag ? x + innen - summe : x));
  const festSumme = fest.reduce<number>((s, f) => s + (f ?? 0), 0);
  const frei = spaltenBreiten(
    bedarf.filter((_, k) => fest[k] === null),
    innen - festSumme,
  );
  let j = 0;
  return bedarf.map((x, k) => (fest[k] !== null ? x : frei[j++]));
}

interface Wort {
  text: string;
  stil: Lauf['stil'];
  breite: number;
  leer: boolean;
}

class Zeichner {
  private readonly breite: number;
  private readonly hoehe: number;
  private readonly innen: number;
  private readonly unten: number;
  private y = INHALT_OBEN;
  private spaltenX: number[] = [];
  private spaltenB: number[] = [];

  constructor(
    private readonly d: jsPDF,
    private readonly font: string,
    private readonly b: TerminBlatt,
  ) {
    this.breite = d.internal.pageSize.getWidth();
    this.hoehe = d.internal.pageSize.getHeight();
    this.innen = this.breite - 2 * RAND;
    this.unten = this.hoehe - RAND - FUSS;
  }

  alles() {
    if (this.b.dienste && !this.b.diensteUnten) this.dienste(this.b.dienste);
    if (this.b.ablauf) this.ablauf();
    if (this.b.dienste && this.b.diensteUnten) {
      if (this.b.ablauf) this.y += 5;
      this.dienste(this.b.dienste);
    }
    this.kopfUndFuss();
  }

  // ── Schrift ────────────────────────────────────────────────────────────────

  private stil(stil: Lauf['stil'], pt: number, grau = false) {
    const fett = stil === 'fett' || stil === 'kleinFett' || stil === 'schild';
    this.d.setFont(this.font, fett ? 'bold' : 'normal');
    this.d.setFontSize(
      stil === 'schild' ? pt - 1.6 : stil === 'kleinFett' ? Math.min(pt, KLEIN) : pt,
    );
    const farbe: Farbe =
      stil === 'rot' ? ROT : stil === 'grau' || grau ? GRAU : stil === 'schild' ? NAVY : TINTE;
    this.d.setTextColor(...farbe);
  }

  private textBreite(t: string, stil: Lauf['stil'], pt: number) {
    this.stil(stil, pt);
    return this.d.getTextWidth(t);
  }

  /** Läufe in Wörter zerlegen (Leerzeichen bleiben eigene „Wörter“) – ein Schild bleibt ein Stück. */
  private woerter(absatz: Absatz, pt: number): Wort[] {
    const aus: Wort[] = [];
    for (const l of absatz) {
      if (l.stil === 'schild') {
        aus.push({
          text: l.text,
          stil: l.stil,
          breite: this.textBreite(l.text, l.stil, pt) + 3.2,
          leer: false,
        });
        continue;
      }
      for (const teil of l.text.split(/(\s+)/)) {
        if (!teil) continue;
        const leer = /^\s+$/.test(teil);
        aus.push({
          text: leer ? ' ' : teil,
          stil: l.stil,
          breite: this.textBreite(leer ? ' ' : teil, l.stil, pt),
          leer,
        });
      }
    }
    return aus;
  }

  /** Ein Absatz in Zeilen der Breite `breite` – am Wortende umbrochen, ein zu langes Wort an der Breite. */
  private umbrechen(absatz: Absatz, breite: number, pt: number): Wort[][] {
    const zeilen: Wort[][] = [[]];
    let x = 0;
    for (const w of this.woerter(absatz, pt)) {
      let akt = zeilen[zeilen.length - 1];
      if (w.leer && akt.length === 0) continue;
      if (x + w.breite > breite && akt.length > 0 && !w.leer) {
        while (akt.length > 0 && akt[akt.length - 1].leer) akt.pop();
        zeilen.push([]);
        akt = zeilen[zeilen.length - 1];
        x = 0;
      }
      if (!w.leer && w.breite > breite && w.stil !== 'schild') {
        this.stil(w.stil, pt);
        const stuecke = this.d.splitTextToSize(w.text, breite) as string[];
        stuecke.forEach((s, i) => {
          if (i > 0) {
            zeilen.push([]);
            akt = zeilen[zeilen.length - 1];
          }
          const sb = this.textBreite(s, w.stil, pt);
          akt.push({ ...w, text: s, breite: sb });
          x = sb;
        });
        continue;
      }
      akt.push(w);
      x += w.breite;
    }
    return zeilen;
  }

  private zelleZeilen(z: Zelle, breite: number) {
    return z.absaetze.map((a) => {
      const pt = a.klein ? KLEIN : GROSS;
      return { pt, zeilen: this.umbrechen(a.laeufe, breite, pt) };
    });
  }

  private zelleHoehe(z: Zelle, breite: number) {
    const teile = this.zelleZeilen(z, breite);
    return (
      teile.reduce((h, t) => h + Math.max(1, t.zeilen.length) * zeilenHoehe(t.pt), 0) +
      ABSATZ * Math.max(0, teile.length - 1)
    );
  }

  /** Eine Zelle ab (x, oben) zeichnen. `grau` färbt Schwarzes grau (Vorlauf). */
  private zelle(z: Zelle, x: number, oben: number, breite: number, grau = false) {
    let y = oben;
    for (const t of this.zelleZeilen(z, breite)) {
      for (const zeile of t.zeilen) {
        const grund = y + t.pt * PT * 0.95;
        let cx = x;
        for (const w of zeile) {
          if (w.stil === 'schild') {
            const sh = (t.pt - 1.6) * PT * 1.25;
            this.d.setFillColor(...SCHILD);
            this.d.roundedRect(cx + 1.2, grund - sh + 0.55, w.breite - 1.2, sh, 0.6, 0.6, 'F');
            this.stil('schild', t.pt);
            this.d.text(w.text, cx + 2.2, grund - 0.15);
          } else {
            this.stil(w.stil, t.pt, grau && w.stil !== 'rot');
            this.d.text(w.text, cx, grund);
          }
          cx += w.breite;
        }
        y += zeilenHoehe(t.pt);
      }
      if (t.zeilen.length === 0) y += zeilenHoehe(t.pt);
      y += ABSATZ;
    }
  }

  private linie(y: number, farbe: Farbe, staerke: number, x = RAND, bis = RAND + this.innen) {
    this.d.setDrawColor(...farbe);
    this.d.setLineWidth(staerke);
    this.d.line(x, y, bis, y);
  }

  private neueSeite() {
    this.d.addPage();
    this.y = INHALT_OBEN;
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
    this.spalten();
    if (this.y + 20 > this.unten) this.neueSeite();
    this.tabellenKopf();
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
        this.tabellenKopf();
      }
      this.zeile(z, h);
      this.y += h;
    });
  }

  private reihenHoeheBei(i: number) {
    const z = this.b.ablauf!.zeilen[i];
    return z ? this.reihenHoehe(z) : 0;
  }

  private spalten() {
    const breiten = ablaufSpalten(this.b.ablauf!, this.innen, (t, stil, pt) =>
      this.textBreite(t, stil, pt),
    );
    this.spaltenB = breiten;
    this.spaltenX = breiten.map((_, k) => RAND + breiten.slice(0, k).reduce((s, x) => s + x, 0));
  }

  private tabellenKopf() {
    const a = this.b.ablauf!;
    this.d.setFont(this.font, 'bold');
    this.d.setFontSize(KOPF);
    this.d.setTextColor(...GRAU);
    a.kopf.forEach((k, i) =>
      this.d.text(k.toUpperCase(), this.spaltenX[i] + POLSTER_X, this.y + 3.4, { charSpace: 0.2 }),
    );
    this.y += 4.8;
    this.linie(this.y, NAVY, 0.35);
  }

  private reihenHoehe(z: BlattZeile) {
    if (z.art !== 'eintrag') return zeilenHoehe(GROSS) + 2 * POLSTER_Y + 0.6;
    return (
      Math.max(...z.zellen.map((c, k) => this.zelleHoehe(c, this.spaltenB[k] - 2 * POLSTER_X))) +
      2 * POLSTER_Y
    );
  }

  private zeile(z: BlattZeile, h: number) {
    const a = this.b.ablauf!;
    const grund = this.y + POLSTER_Y + 0.3 + GROSS * PT * 0.95;
    if (z.art === 'eintrag') {
      z.zellen.forEach((c, k) =>
        this.zelle(
          c,
          this.spaltenX[k] + POLSTER_X,
          this.y + POLSTER_Y,
          this.spaltenB[k] - 2 * POLSTER_X,
          z.vorlauf,
        ),
      );
      this.linie(this.y + h, LINIE, 0.15);
      return;
    }
    const dunkel = z.art === 'beginn' || z.art === 'ende';
    this.d.setFillColor(...(dunkel ? NAVY : BAND));
    this.d.rect(RAND, this.y + 0.3, this.innen, h - 0.3, 'F');
    this.d.setFont(this.font, 'bold');
    this.d.setFontSize(dunkel ? GROSS + 0.8 : GROSS);
    this.d.setTextColor(...(dunkel ? WEISS : TINTE));
    const mitZeit = a.arten[0] === 'zeit';
    const textX = (mitZeit ? this.spaltenX[a.arten.indexOf('eintrag')] : RAND) + POLSTER_X;
    if (z.art === 'abschnitt') {
      this.d.text(z.titel, RAND + POLSTER_X, grund);
      if (z.dauer) {
        this.d.setFont(this.font, 'normal');
        this.d.setTextColor(...GRAU);
        this.d.text(z.dauer, RAND + this.innen - POLSTER_X, grund, { align: 'right' });
      }
      return;
    }
    const wort = z.art === 'beginn' ? 'Beginn' : 'Ende';
    if (mitZeit) this.d.text(z.zeit, this.spaltenX[0] + POLSTER_X, grund);
    this.d.text(mitZeit ? wort : `${wort} ${z.zeit}`, mitZeit ? textX : RAND + POLSTER_X, grund);
    if (z.art === 'ende' && z.dauer) {
      this.d.setFont(this.font, 'normal');
      this.d.setFontSize(KLEIN);
      this.d.text(z.dauer, RAND + this.innen - POLSTER_X, grund, { align: 'right' });
    }
  }

  // ── Kopf und Fuß (zuletzt – erst jetzt steht die Seitenzahl fest) ─────────

  private kopfUndFuss() {
    const seiten = this.d.getNumberOfPages();
    const rechts = this.breite - RAND;
    for (let s = 1; s <= seiten; s++) {
      this.d.setPage(s);
      this.d.setFont(this.font, 'bold');
      this.d.setFontSize(17);
      this.d.setTextColor(...TINTE);
      const titel = this.d.splitTextToSize(this.b.titel, this.innen * 0.68) as string[];
      this.d.text(titel[0] ?? '', RAND, RAND + 6);
      this.d.setFont(this.font, 'normal');
      this.d.setFontSize(9.5);
      this.d.setTextColor(...GRAU);
      this.d.text(this.b.untertitel, RAND, RAND + 11.5);
      if (this.b.gemeinde) {
        this.d.setFont(this.font, 'bold');
        this.d.setFontSize(8.5);
        this.d.setTextColor(...TINTE);
        this.d.text(this.b.gemeinde, rechts, RAND + 7, { align: 'right' });
      }
      this.d.setFont(this.font, 'normal');
      this.d.setFontSize(8);
      this.d.setTextColor(...GRAU);
      this.d.text(this.b.stand, rechts, RAND + 11.2, { align: 'right' });
      this.linie(RAND + 14, NAVY, 0.6);

      this.linie(this.hoehe - RAND - 4, LINIE, 0.2);
      this.d.setFontSize(7.5);
      this.d.setTextColor(...HELLGRAU);
      this.d.text(
        [this.b.gemeinde, this.b.app].filter(Boolean).join(' · '),
        RAND,
        this.hoehe - RAND,
      );
      this.d.text(`Seite ${s} von ${seiten}`, rechts, this.hoehe - RAND, { align: 'right' });
    }
    this.d.setTextColor(0);
  }
}
