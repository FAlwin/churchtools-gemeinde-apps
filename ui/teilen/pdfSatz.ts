import type { jsPDF } from 'jspdf';
import type { Absatz, Lauf, Rgb, Zelle } from '@shared/ct/terminBlatt';
import { spaltenBreiten } from './listenPdf';

/**
 * **Der Satz der geteilten Blätter** (E8) – was Termin-Blatt (`terminBlattPdf.ts`) und Plan-Blatt (`planBlattPdf.ts`)
 * gleich brauchen: Lato im ChurchTools-Look, Zellen mit gemischter Auszeichnung (fett, grau, rot, Schild), am Wortende
 * umbrochen, Spaltenbreiten nach Bedarf, Tabellenkopf, und auf jeder Seite Kopf (Titel, Datum, Gemeinde, Stand) und Fuß
 * („Seite x von y“). Bis E8-2 stand das nur im Termin-Blatt – das Plan-Blatt hätte es sonst nachgebaut.
 */

// mm, Schriftgrößen in pt.
export const RAND = 14;
export const INHALT_OBEN = RAND + 19;
const FUSS = 8;
export const GROSS = 9;
export const KLEIN = 7.8;
export const KOPF = 6.8;
export const PT = 0.3528;
export const POLSTER_X = 1.5;
export const POLSTER_Y = 1.3;
const ABSATZ = 0.5;

export type Farbe = [number, number, number];
export const NAVY: Farbe = [29, 41, 61];
export const TINTE: Farbe = [15, 23, 43];
export const GRAU: Farbe = [91, 107, 128];
const HELLGRAU: Farbe = [138, 153, 173];
export const LINIE: Farbe = [221, 227, 234];
export const BAND: Farbe = [238, 242, 246];
const SCHILD: Farbe = [232, 238, 246];
const ROT: Farbe = [231, 0, 11];
export const WEISS: Farbe = [255, 255, 255];
/** Links (`--blue` der ChurchTools-Oberfläche). */
const BLAU: Farbe = [21, 93, 252];
/** Hintergrund von Code im Text. */
const CODE: Farbe = [238, 242, 246];

export const zeilenHoehe = (pt: number) => pt * PT * 1.3;

/** Was oben und unten auf jeder Seite steht. */
export interface BlattKopf {
  titel: string;
  untertitel: string;
  gemeinde: string | null;
  /** „Dienstplaner“, „Musik-App“ – unten links neben der Gemeinde. */
  app: string;
  stand: string;
}

/**
 * Ein neues A4-Dokument mit Lato. `schrift` nur für Tests („helvetica“): Mit eingebetteter Lato steht der Text nicht
 * lesbar im PDF. jsPDF wird erst hier geladen – die Apps starten ohne den Brocken. Die kursiven Schnitte bettet das
 * Protokoll-PDF selbst ein (`pdfSchriftKursiv.ts`) – stünde der Aufruf hier, trüge jede App mit PDF sie im ZIP.
 */
export async function neuesDokument(
  quer: boolean,
  schrift?: string,
): Promise<{ d: jsPDF; font: string }> {
  const { jsPDF } = await import('jspdf');
  const d = new jsPDF({ unit: 'mm', format: 'a4', orientation: quer ? 'landscape' : 'portrait' });
  if (schrift) return { d, font: schrift };
  const { latoEinbetten, PDF_SCHRIFT } = await import('./pdfSchrift');
  latoEinbetten(d);
  return { d, font: PDF_SCHRIFT };
}

// ── Spaltenbreiten ───────────────────────────────────────────────────────────

/** Misst einen Text in mm – in der Zeichnung mit jsPDF, im Test mit festen Breiten. */
export type Messen = (text: string, stil: Lauf['stil'], pt: number) => number;

/**
 * Wie eine Spalte breit wird: `fest` = so breit wie ihr längster Wert, sie bricht nie um (Uhrzeit, Datum); sonst nach
 * Bedarf zwischen `min` und `max`. Die Spalte mit `rest` bekommt übrigen Platz; ohne `rest`-Spalte teilen ihn sich alle
 * übrigen – außer denen mit `ohneRest` (die Termin-Spalte des Plans soll die Dienste nicht nach rechts schieben).
 */
export type SpaltenRegel =
  | { fest: true }
  | { min: number; max: number; rest?: boolean; ohneRest?: boolean };

/** So breit wie der längste Absatz der Spalte (ohne Umbruch), mindestens wie ihr Kopf – samt Polster. */
export function naturBreite(kopf: string, zellen: readonly Zelle[], messen: Messen): number {
  return (
    Math.max(
      messen(kopf.toUpperCase(), 'fett', KOPF),
      ...zellen.map((c) =>
        Math.max(
          0,
          ...c.absaetze.map((p) =>
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
    2 * POLSTER_X
  );
}

/**
 * **Spaltenbreiten einer Tabelle** (mm): feste Spalten so breit wie ihr längster Wert, die übrigen nach Bedarf
 * (`spaltenBreiten` der Druckliste); bleibt Platz, geht er an die `rest`-Spalte (sonst gleichmäßig an alle freien).
 */
export function tabellenBreiten(
  kopf: readonly string[],
  zeilen: readonly (readonly Zelle[])[],
  innen: number,
  messen: Messen,
  regeln: readonly SpaltenRegel[],
): number[] {
  const natur = (k: number) =>
    naturBreite(
      kopf[k],
      zeilen.map((z) => z[k]),
      messen,
    );
  const fest = regeln.map((r, k) => ('fest' in r ? natur(k) + 0.5 : null));
  const bedarf = regeln.map((r, k) => {
    const f = fest[k];
    if (f !== null || 'fest' in r) return f ?? 0;
    return Math.min(r.max, Math.max(r.min, natur(k)));
  });
  const summe = bedarf.reduce((s, x) => s + x, 0);
  if (summe <= innen) {
    const rest = regeln.findIndex((r) => !('fest' in r) && r.rest);
    if (rest >= 0) return bedarf.map((x, k) => (k === rest ? x + innen - summe : x));
    const teilen = (r: SpaltenRegel) => !('fest' in r) && !r.ohneRest;
    const frei = regeln.filter(teilen).length;
    return bedarf.map((x, k) => (teilen(regeln[k]) && frei > 0 ? x + (innen - summe) / frei : x));
  }
  const festSumme = fest.reduce<number>((s, f) => s + (f ?? 0), 0);
  const frei = spaltenBreiten(
    bedarf.filter((_, k) => fest[k] === null),
    innen - festSumme,
  );
  let j = 0;
  return bedarf.map((x, k) => (fest[k] !== null ? x : frei[j++]));
}

// ── Satz ─────────────────────────────────────────────────────────────────────

export interface Wort {
  text: string;
  stil: Lauf['stil'];
  breite: number;
  leer: boolean;
  /** Der Lauf, aus dem das Wort kommt – für Kursiv, Farben, Linien und Link. */
  lauf: Lauf;
}

/** Ein Absatz einer Zelle, in Zeilen umbrochen. */
export interface AbsatzZeilen {
  pt: number;
  zeilen: Wort[][];
}

/** Grundlage beider Blätter: Schrift, Zellen, Linien, Seiten, Tabellenkopf, Kopf und Fuß. */
export class PdfSatz {
  protected readonly breite: number;
  protected readonly hoehe: number;
  protected readonly innen: number;
  protected readonly unten: number;
  protected y = INHALT_OBEN;

  constructor(
    protected readonly d: jsPDF,
    protected readonly font: string,
  ) {
    this.breite = d.internal.pageSize.getWidth();
    this.hoehe = d.internal.pageSize.getHeight();
    this.innen = this.breite - 2 * RAND;
    this.unten = this.hoehe - RAND - FUSS;
  }

  /** Die Schriftfarbe eines Laufs: eigene Farbe, sonst Link-Blau, sonst die Farbe des `stil` (`grau` = Vorlauf). */
  private farbe(stil: Lauf['stil'], grau: boolean, l?: Pick<Lauf, 'farbe' | 'link'>): Rgb {
    if (l?.farbe) return l.farbe;
    if (l?.link) return BLAU;
    return stil === 'rot' ? ROT : stil === 'grau' || grau ? GRAU : stil === 'schild' ? NAVY : TINTE;
  }

  protected stil(
    stil: Lauf['stil'],
    pt: number,
    grau = false,
    l?: Pick<Lauf, 'kursiv' | 'farbe' | 'link'>,
  ) {
    const fett = stil === 'fett' || stil === 'kleinFett' || stil === 'schild';
    const kursiv = !!l?.kursiv;
    this.d.setFont(
      this.font,
      fett && kursiv ? 'bolditalic' : kursiv ? 'italic' : fett ? 'bold' : 'normal',
    );
    this.d.setFontSize(
      stil === 'schild' ? pt - 1.6 : stil === 'kleinFett' ? Math.min(pt, KLEIN) : pt,
    );
    this.d.setTextColor(...this.farbe(stil, grau, l));
  }

  protected textBreite(t: string, stil: Lauf['stil'], pt: number, kursiv = false) {
    this.stil(stil, pt, false, { kursiv });
    return this.d.getTextWidth(t);
  }

  protected messen: Messen = (t, stil, pt) => this.textBreite(t, stil, pt);

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
          lauf: l,
        });
        continue;
      }
      for (const teil of l.text.split(/(\s+)/)) {
        if (!teil) continue;
        const leer = /^\s+$/.test(teil);
        aus.push({
          text: leer ? ' ' : teil,
          stil: l.stil,
          breite: this.textBreite(leer ? ' ' : teil, l.stil, pt, l.kursiv),
          leer,
          lauf: l,
        });
      }
    }
    return aus;
  }

  /** Ein Absatz in Zeilen der Breite `breite` – am Wortende umbrochen, ein zu langes Wort an der Breite. */
  protected umbrechen(absatz: Absatz, breite: number, pt: number): Wort[][] {
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
        this.stil(w.stil, pt, false, w.lauf);
        const stuecke = this.d.splitTextToSize(w.text, breite) as string[];
        stuecke.forEach((s, i) => {
          if (i > 0) {
            zeilen.push([]);
            akt = zeilen[zeilen.length - 1];
          }
          const sb = this.textBreite(s, w.stil, pt, w.lauf.kursiv);
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

  protected zelleZeilen(z: Zelle, breite: number): AbsatzZeilen[] {
    return z.absaetze.map((a) => {
      const pt = a.klein ? KLEIN : GROSS;
      return { pt, zeilen: this.umbrechen(a.laeufe, breite, pt) };
    });
  }

  protected zelleHoehe(z: Zelle, breite: number) {
    const teile = this.zelleZeilen(z, breite);
    return (
      teile.reduce((h, t) => h + Math.max(1, t.zeilen.length) * zeilenHoehe(t.pt), 0) +
      ABSATZ * Math.max(0, teile.length - 1)
    );
  }

  /** Eine Zelle ab (x, oben) zeichnen. `grau` färbt Schwarzes grau (Vorlauf). */
  protected zelle(z: Zelle, x: number, oben: number, breite: number, grau = false) {
    let y = oben;
    for (const t of this.zelleZeilen(z, breite)) {
      for (const zeile of t.zeilen) {
        this.zeileZeichnen(zeile, x, y, t.pt, grau);
        y += zeilenHoehe(t.pt);
      }
      if (t.zeilen.length === 0) y += zeilenHoehe(t.pt);
      y += ABSATZ;
    }
  }

  /**
   * Eine umbrochene Zeile ab (x, oben): Hintergrund (markiert, Code) unter dem Text, Unter- und Durchstreichen darüber,
   * ein Link als anklickbare Fläche.
   */
  protected zeileZeichnen(
    zeile: readonly Wort[],
    x: number,
    oben: number,
    pt: number,
    grau = false,
  ) {
    const grund = oben + pt * PT * 0.95;
    const h = zeilenHoehe(pt);
    let cx = x;
    for (const w of zeile) {
      const l = w.lauf;
      if (w.stil === 'schild') {
        const sh = (pt - 1.6) * PT * 1.25;
        this.d.setFillColor(...SCHILD);
        this.d.roundedRect(cx + 1.2, grund - sh + 0.55, w.breite - 1.2, sh, 0.6, 0.6, 'F');
        this.stil('schild', pt);
        this.d.text(w.text, cx + 2.2, grund - 0.15);
        cx += w.breite;
        continue;
      }
      const hinten = l.hintergrund ?? (l.code ? CODE : null);
      if (hinten) {
        this.d.setFillColor(...hinten);
        this.d.rect(cx, oben, w.breite, h, 'F');
      }
      const farbe = this.farbe(w.stil, grau && w.stil !== 'rot', l);
      this.stil(w.stil, pt, grau && w.stil !== 'rot', l);
      this.d.text(w.text, cx, grund);
      const unter = l.unterstrichen || !!l.link;
      if (unter || l.durchgestrichen) {
        this.d.setDrawColor(...farbe);
        this.d.setLineWidth(Math.max(0.12, pt * PT * 0.06));
        if (unter) this.d.line(cx, grund + 0.45, cx + w.breite, grund + 0.45);
        if (l.durchgestrichen) {
          const mitte = grund - pt * PT * 0.28;
          this.d.line(cx, mitte, cx + w.breite, mitte);
        }
      }
      if (l.link) this.d.link(cx, oben, w.breite, h, { url: l.link });
      cx += w.breite;
    }
  }

  protected linie(y: number, farbe: Farbe, staerke: number, x = RAND, bis = RAND + this.innen) {
    this.d.setDrawColor(...farbe);
    this.d.setLineWidth(staerke);
    this.d.line(x, y, bis, y);
  }

  protected neueSeite() {
    this.d.addPage();
    this.y = INHALT_OBEN;
  }

  /** Linke Kanten der Spalten aus ihren Breiten. */
  protected positionen(breiten: readonly number[]): number[] {
    return breiten.map((_, k) => RAND + breiten.slice(0, k).reduce((s, x) => s + x, 0));
  }

  /** Der Tabellenkopf: Großbuchstaben grau, darunter eine dunkle Linie. */
  protected tabellenKopf(kopf: readonly string[], xs: readonly number[]) {
    this.d.setFont(this.font, 'bold');
    this.d.setFontSize(KOPF);
    this.d.setTextColor(...GRAU);
    kopf.forEach((k, i) =>
      this.d.text(k.toUpperCase(), xs[i] + POLSTER_X, this.y + 3.4, { charSpace: 0.2 }),
    );
    this.y += 4.8;
    this.linie(this.y, NAVY, 0.35);
  }

  /** Höhe einer Tabellenzeile aus ihren Zellen. */
  protected zeilenHoeheAus(zellen: readonly Zelle[], breiten: readonly number[]) {
    return (
      Math.max(...zellen.map((c, k) => this.zelleHoehe(c, breiten[k] - 2 * POLSTER_X))) +
      2 * POLSTER_Y
    );
  }

  /** Eine Tabellenzeile zeichnen, darunter eine feine Linie. */
  protected tabellenZeile(
    zellen: readonly Zelle[],
    xs: readonly number[],
    breiten: readonly number[],
    h: number,
    grau = false,
  ) {
    zellen.forEach((c, k) =>
      this.zelle(c, xs[k] + POLSTER_X, this.y + POLSTER_Y, breiten[k] - 2 * POLSTER_X, grau),
    );
    this.linie(this.y + h, LINIE, 0.15);
  }

  /** Ein graues Band über die ganze Breite (Abschnitt, Gruppe), rechts optional ein grauer Zusatz. */
  protected band(titel: string, zusatz: string | null, h: number) {
    const grund = this.y + POLSTER_Y + 0.3 + GROSS * PT * 0.95;
    this.d.setFillColor(...BAND);
    this.d.rect(RAND, this.y + 0.3, this.innen, h - 0.3, 'F');
    this.d.setFont(this.font, 'bold');
    this.d.setFontSize(GROSS);
    this.d.setTextColor(...TINTE);
    this.d.text(titel, RAND + POLSTER_X, grund);
    if (zusatz) {
      this.d.setFont(this.font, 'normal');
      this.d.setTextColor(...GRAU);
      this.d.text(zusatz, RAND + this.innen - POLSTER_X, grund, { align: 'right' });
    }
  }

  protected bandHoehe() {
    return zeilenHoehe(GROSS) + 2 * POLSTER_Y + 0.6;
  }

  /** Kopf und Fuß auf jeder Seite – zuletzt, erst dann steht die Seitenzahl fest. */
  protected kopfUndFuss(k: BlattKopf) {
    const seiten = this.d.getNumberOfPages();
    const rechts = this.breite - RAND;
    for (let s = 1; s <= seiten; s++) {
      this.d.setPage(s);
      this.d.setFont(this.font, 'bold');
      this.d.setFontSize(17);
      this.d.setTextColor(...TINTE);
      const titel = this.d.splitTextToSize(k.titel, this.innen * 0.68) as string[];
      this.d.text(titel[0] ?? '', RAND, RAND + 6);
      this.d.setFont(this.font, 'normal');
      this.d.setFontSize(9.5);
      this.d.setTextColor(...GRAU);
      this.d.text(k.untertitel, RAND, RAND + 11.5);
      if (k.gemeinde) {
        this.d.setFont(this.font, 'bold');
        this.d.setFontSize(8.5);
        this.d.setTextColor(...TINTE);
        this.d.text(k.gemeinde, rechts, RAND + 7, { align: 'right' });
      }
      this.d.setFont(this.font, 'normal');
      this.d.setFontSize(8);
      this.d.setTextColor(...GRAU);
      this.d.text(k.stand, rechts, RAND + 11.2, { align: 'right' });
      this.linie(RAND + 14, NAVY, 0.6);

      this.linie(this.hoehe - RAND - 4, LINIE, 0.2);
      this.d.setFontSize(7.5);
      this.d.setTextColor(...HELLGRAU);
      this.d.text([k.gemeinde, k.app].filter(Boolean).join(' · '), RAND, this.hoehe - RAND);
      this.d.text(`Seite ${s} von ${seiten}`, rechts, this.hoehe - RAND, { align: 'right' });
    }
    this.d.setTextColor(0);
  }
}
