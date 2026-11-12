import type { jsPDF } from 'jspdf';
import type { Absatz, Zelle } from '@shared/ct/terminBlatt';
import {
  LEER_TEXT,
  type BlattTeil,
  type KastenZeile,
  type ProtokollBlatt,
  type Rand,
  type TabellenZelleBlatt,
  type UebersichtEintrag,
  type Zeichen,
} from '@shared/protokolle/protokollBlatt';
import {
  BAND,
  GRAU,
  GROSS,
  INHALT_OBEN,
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
  zeilenHoehe,
  type Farbe,
  type Wort,
} from './pdfSatz';

/**
 * **Das Protokoll als PDF** (Bauplan S6-3a) – gezeichnet, was `shared/protokolle/protokollBlatt.ts` festgelegt hat, auf
 * dem gemeinsamen Satz der geteilten Blätter (`pdfSatz.ts`: Lato, Kopf und Fuß mit Seitenzahl) – kein zweiter Satz.
 * Umbrochen wird Zeile für Zeile, ein langer Absatz läuft also über die Seite; eine Überschrift steht nie allein unten,
 * eine Tabellenzeile wird nie zerteilt.
 *
 * `schrift` nur für Tests („helvetica“): Mit eingebetteter Lato steht der Text nicht lesbar im PDF.
 */
export async function protokollPdf(b: ProtokollBlatt, schrift?: string): Promise<jsPDF> {
  const { d, font } = await neuesDokument(false, schrift);
  // Kursiv aus dem Editor (Alwin 12.11.2026: echte Kursiv-Lato) – nur hier, damit nur dieses PDF die Schnitte trägt.
  if (!schrift) (await import('./pdfSchriftKursiv')).latoKursivEinbetten(d);
  new ProtokollZeichner(d, font, b).alles();
  return d;
}

// mm, Schriftgrößen in pt.
const EINZUG = 6;
const ZEICHEN_BREITE = 5;
const RAND_POLSTER = 2.6;
const ABSTAND = 1.6;
const PUNKT_PT = 12;
const UNTERPUNKT_PT = 10.5;
const UEBERSCHRIFT_PT = 10;
const KLEINE_UEBERSCHRIFT_PT = 9.5;

const GRUEN: Farbe = [22, 163, 74];
const GRUEN_HELL: Farbe = [240, 253, 244];
const BLAU: Farbe = [21, 93, 252];
const BLAU_HELL: Farbe = [239, 246, 255];
const KASTEN: Farbe = [246, 248, 250];

/** Eine Zeile, wie sie fließt: ihre Wörter, wo sie beginnt, und was davor steht. */
interface FlussZeile {
  woerter: Wort[];
  pt: number;
  x: number;
  /** Abstand nach dem Absatz, den diese Zeile beendet. */
  danach: number;
  zeichen?: { z: Zeichen; x: number };
}

/** Der Hintergrund eines Blocks – Zeile für Zeile gemalt, damit er mit über die Seite läuft. */
interface Hinterlegung {
  x: number;
  breite: number;
  farbe: Farbe | null;
  balken: Farbe | null;
}

const RAENDER: Record<Rand, { farbe: Farbe | null; balken: Farbe }> = {
  zitat: { farbe: null, balken: LINIE },
  beschluss: { farbe: GRUEN_HELL, balken: GRUEN },
  termin: { farbe: BLAU_HELL, balken: BLAU },
};

/** Überschriften sind fett – Kursiv, Farben und Links bleiben. */
const alsFett = (a: Absatz): Absatz => a.map((l) => ({ ...l, stil: 'fett' }));

class ProtokollZeichner extends PdfSatz {
  constructor(
    d: jsPDF,
    font: string,
    private readonly b: ProtokollBlatt,
  ) {
    super(d, font);
  }

  alles() {
    this.fliessen(this.absatzZeilen(this.b.vermerk, RAND, this.innen, GROSS, 0.6));
    this.y += 3;
    if (!this.b.teile.length)
      this.fliessen(
        this.absatzZeilen([[{ text: LEER_TEXT, stil: 'grau' }]], RAND, this.innen, GROSS),
      );
    for (const t of this.b.teile) this.teil(t);
    this.uebersicht();
    this.kopfUndFuss(this.b);
  }

  // ── Fluss ──────────────────────────────────────────────────────────────────

  /** Absätze in Zeilen der Breite `breite` ab `x`. */
  private absatzZeilen(
    absaetze: readonly Absatz[],
    x: number,
    breite: number,
    pt: number,
    zwischen = 0.5,
    danach = ABSTAND,
  ): FlussZeile[] {
    const aus: FlussZeile[] = [];
    absaetze.forEach((a, i) => {
      const zeilen = this.umbrechen(a, breite, pt);
      zeilen.forEach((woerter, j) =>
        aus.push({
          woerter,
          pt,
          x,
          danach: j === zeilen.length - 1 ? (i === absaetze.length - 1 ? danach : zwischen) : 0,
        }),
      );
    });
    return aus;
  }

  /**
   * Zeilen untereinander, mit Seitenwechsel vor jeder Zeile, die nicht mehr passt. Eine Hinterlegung (Beschluss, Termin,
   * fester Punkt) wird je Zeile gemalt, oben und unten mit etwas Luft.
   */
  private fliessen(zeilen: readonly FlussZeile[], h: Hinterlegung | null = null, polster = 0) {
    zeilen.forEach((z, i) => {
      const oben = i === 0 ? polster : 0;
      const unten = i === zeilen.length - 1 ? polster : 0;
      const hoehe = zeilenHoehe(z.pt);
      if (this.y + oben + hoehe + unten > this.unten) this.neueSeite();
      if (h) {
        const flaeche = oben + hoehe + unten + (unten ? 0 : z.danach);
        if (h.farbe) {
          this.d.setFillColor(...h.farbe);
          this.d.rect(h.x, this.y, h.breite, flaeche, 'F');
        }
        if (h.balken) {
          this.d.setFillColor(...h.balken);
          this.d.rect(h.x, this.y, 0.8, flaeche, 'F');
        }
      }
      this.y += oben;
      if (z.zeichen) this.zeichen(z.zeichen.z, z.zeichen.x, this.y, z.pt);
      this.zeileZeichnen(z.woerter, z.x, this.y, z.pt);
      this.y += hoehe + unten + (h && unten ? 0 : z.danach);
    });
    if (h && zeilen.length) this.y += ABSTAND;
  }

  /** Aufzählungspunkt, Nummer oder Kästchen vor der ersten Zeile. */
  private zeichen(z: Zeichen, x: number, oben: number, pt: number) {
    const grund = oben + pt * PT * 0.95;
    this.stil(undefined, pt);
    if (z.art === 'punkt') {
      this.d.text('•', x + 1, grund);
      return;
    }
    if (z.art === 'nummer') {
      this.d.text(`${z.nr}.`, x + ZEICHEN_BREITE - 1.2, grund, { align: 'right' });
      return;
    }
    const s = pt * PT * 0.72;
    const top = grund - s + 0.1;
    this.d.setDrawColor(...GRAU);
    this.d.setLineWidth(0.25);
    this.d.rect(x + 0.4, top, s, s, 'S');
    if (z.an) {
      this.d.setDrawColor(...TINTE);
      this.d.setLineWidth(0.35);
      this.d.line(x + 0.4 + s * 0.2, top + s * 0.55, x + 0.4 + s * 0.42, top + s * 0.78);
      this.d.line(x + 0.4 + s * 0.42, top + s * 0.78, x + 0.4 + s * 0.82, top + s * 0.22);
    }
  }

  // ── Teile ──────────────────────────────────────────────────────────────────

  private links(einzug: number) {
    return RAND + einzug * EINZUG;
  }

  private teil(t: BlattTeil) {
    const x = this.links(t.einzug);
    const breite = RAND + this.innen - x;
    switch (t.art) {
      case 'punkt':
      case 'ueberschrift': {
        const pt =
          t.art === 'punkt'
            ? t.ebene === 0
              ? PUNKT_PT
              : UNTERPUNKT_PT
            : t.klein
              ? KLEINE_UEBERSCHRIFT_PT
              : UEBERSCHRIFT_PT;
        const vor = t.art === 'punkt' && t.ebene === 0 ? 3.5 : 2.2;
        const nummer = t.art === 'punkt' && t.nummer ? [{ text: `${t.nummer}  ` }] : [];
        const absaetze = t.absaetze.map((a, i) => alsFett(i === 0 ? [...nummer, ...a] : a));
        const zeilen = this.absatzZeilen(
          absaetze.length ? absaetze : [alsFett(nummer)],
          x,
          breite,
          pt,
          0.5,
          1.2,
        );
        // Nie allein unten: die Überschrift wandert mit zwei Zeilen Text auf die nächste Seite.
        const hoehe = zeilen.reduce((s, z) => s + zeilenHoehe(z.pt), 0);
        if (this.y > INHALT_OBEN && this.y + vor + hoehe + 2 * zeilenHoehe(GROSS) > this.unten)
          this.neueSeite();
        else if (this.y > INHALT_OBEN) this.y += vor;
        this.fliessen(zeilen);
        return;
      }
      case 'text':
        this.text(t.absaetze, x, breite, t.zeichen, t.rand);
        return;
      case 'tabelle':
        this.tabelle(t.zeilen, x, breite);
        return;
      case 'linie':
        if (this.y + 4 > this.unten) this.neueSeite();
        this.linie(this.y + 1.5, LINIE, 0.3, x, RAND + this.innen);
        this.y += 4;
        return;
      case 'kasten':
        this.kasten(t.zeilen, x, breite);
        return;
    }
  }

  private text(
    absaetze: readonly Absatz[],
    x: number,
    breite: number,
    zeichen?: Zeichen,
    rand?: Rand,
  ) {
    const r = rand ? RAENDER[rand] : null;
    const innenX = x + (r ? RAND_POLSTER : 0) + (zeichen ? ZEICHEN_BREITE : 0);
    const innenBreite = breite - (innenX - x) - (r?.farbe ? RAND_POLSTER : 0);
    const zeilen = this.absatzZeilen(
      absaetze,
      innenX,
      innenBreite,
      GROSS,
      0.5,
      zeichen ? 0.8 : ABSTAND,
    );
    if (zeichen && zeilen[0]) zeilen[0].zeichen = { z: zeichen, x: innenX - ZEICHEN_BREITE };
    if (r)
      this.fliessen(zeilen, { x, breite, farbe: r.farbe, balken: r.balken }, r.farbe ? 1.2 : 0.4);
    else this.fliessen(zeilen);
  }

  /** Ein fester Punkt: grau hinterlegt, Zeile für Zeile. */
  private kasten(zeilen: readonly KastenZeile[], x: number, breite: number) {
    const fluss: FlussZeile[] = [];
    for (const z of zeilen) {
      const zx = x + RAND_POLSTER + (z.eingerueckt ? EINZUG : 0) + (z.zeichen ? ZEICHEN_BREITE : 0);
      const teil = this.absatzZeilen(
        z.absaetze,
        zx,
        x + breite - RAND_POLSTER - zx,
        GROSS,
        0.5,
        0.6,
      );
      if (z.zeichen && teil[0]) teil[0].zeichen = { z: z.zeichen, x: zx - ZEICHEN_BREITE };
      fluss.push(...teil);
    }
    if (fluss.length) fluss[fluss.length - 1].danach = 0;
    this.fliessen(fluss, { x, breite, farbe: KASTEN, balken: null }, 1.6);
  }

  // ── Tabelle ────────────────────────────────────────────────────────────────

  /**
   * Eine Tabelle (K3a): verbundene Zellen über ihre Spalten und Zeilen, Kopfzellen fett und hinterlegt, Zellfarben wie im
   * Editor. Zeilen, die eine verbundene Zelle zusammenhält, wechseln nur gemeinsam die Seite.
   */
  private tabelle(zeilen: readonly (readonly TabellenZelleBlatt[])[], x: number, breite: number) {
    // Wo jede Zelle steht – eine Zelle, die über Zeilen reicht, belegt die Plätze darunter.
    const belegt: boolean[][] = zeilen.map(() => []);
    const lagen: { c: TabellenZelleBlatt; z: number; s: number }[] = [];
    let spalten = 0;
    zeilen.forEach((reihe, z) => {
      let s = 0;
      for (const c of reihe) {
        while (belegt[z][s]) s++;
        for (let dz = 0; dz < c.zeilen && z + dz < zeilen.length; dz++)
          for (let ds = 0; ds < c.spalten; ds++) belegt[z + dz][s + ds] = true;
        lagen.push({ c, z, s });
        s += c.spalten;
      }
      spalten = Math.max(spalten, belegt[z].length);
    });
    if (!spalten) return;
    const zelle = (c: TabellenZelleBlatt): Zelle => ({
      absaetze: (c.absaetze.length ? c.absaetze : [[]]).map((a) => ({
        laeufe: c.kopf ? alsFett(a) : a,
      })),
    });
    // Breiten nach Bedarf aus den einfachen Zellen; der Rest verteilt sich auf alle Spalten.
    const raster: Zelle[][] = zeilen.map(() =>
      Array.from({ length: spalten }, () => ({ absaetze: [] })),
    );
    for (const l of lagen) if (l.c.spalten === 1) raster[l.z][l.s] = zelle(l.c);
    const breiten = tabellenBreiten(
      Array.from({ length: spalten }, () => ''),
      raster,
      breite,
      this.messen,
      Array.from({ length: spalten }, () => ({ min: 12, max: breite })),
    );
    const xs = breiten.map((_, k) => x + breiten.slice(0, k).reduce((a, b) => a + b, 0));
    const zellBreite = (l: { c: TabellenZelleBlatt; s: number }) =>
      breiten.slice(l.s, l.s + l.c.spalten).reduce((a, b) => a + b, 0);
    // Zeilenhöhen: einzeilige Zellen bestimmen sie; reicht eine verbundene Zelle weiter, wird ihre letzte Zeile höher.
    const hoehen = zeilen.map(() => zeilenHoehe(GROSS) + 2 * POLSTER_Y);
    const innenHoehe = (l: { c: TabellenZelleBlatt; s: number }) =>
      this.zelleHoehe(zelle(l.c), zellBreite(l) - 2 * POLSTER_X) + 2 * POLSTER_Y;
    for (const l of lagen) if (l.c.zeilen === 1) hoehen[l.z] = Math.max(hoehen[l.z], innenHoehe(l));
    for (const l of lagen) {
      if (l.c.zeilen === 1) continue;
      const bis = Math.min(zeilen.length, l.z + l.c.zeilen);
      const summe = hoehen.slice(l.z, bis).reduce((a, b) => a + b, 0);
      const fehlt = innenHoehe(l) - summe;
      if (fehlt > 0) hoehen[bis - 1] += fehlt;
    }
    // Blöcke aus Zeilen, die zusammenbleiben müssen.
    const ende = zeilen.map((_, z) => z);
    for (const l of lagen) {
      const bis = Math.min(zeilen.length, l.z + l.c.zeilen) - 1;
      for (let z = l.z; z <= bis; z++) ende[z] = Math.max(ende[z], bis);
    }
    let z = 0;
    while (z < zeilen.length) {
      let bis = ende[z];
      for (let i = z; i <= bis; i++) bis = Math.max(bis, ende[i]);
      const block = hoehen.slice(z, bis + 1).reduce((a, b) => a + b, 0);
      if (this.y + block > this.unten && this.y > INHALT_OBEN) this.neueSeite();
      const tops = hoehen
        .slice(z, bis + 1)
        .map((_, i) => this.y + hoehen.slice(z, z + i).reduce((a, b) => a + b, 0));
      for (const l of lagen.filter((l) => l.z >= z && l.z <= bis)) {
        const top = tops[l.z - z];
        const h = hoehen
          .slice(l.z, Math.min(zeilen.length, l.z + l.c.zeilen))
          .reduce((a, b) => a + b, 0);
        const w = zellBreite(l);
        const fuellung = l.c.hintergrund ?? (l.c.kopf ? BAND : null);
        if (fuellung) {
          this.d.setFillColor(...fuellung);
          this.d.rect(xs[l.s], top, w, h, 'F');
        }
        this.d.setDrawColor(...LINIE);
        this.d.setLineWidth(0.2);
        this.d.rect(xs[l.s], top, w, h, 'S');
        this.zelle(zelle(l.c), xs[l.s] + POLSTER_X, top + POLSTER_Y, w - 2 * POLSTER_X);
      }
      this.y += block;
      z = bis + 1;
    }
    this.y += ABSTAND + 0.6;
  }

  // ── Übersicht ──────────────────────────────────────────────────────────────

  /** Am Ende: Beschlüsse · To-Dos · Termine · Nächste Sitzung – je ein Band mit Anzahl, darunter die Einträge. */
  private uebersicht() {
    const u = this.b.uebersicht;
    const titelHoehe = zeilenHoehe(PUNKT_PT) + 4;
    if (this.y + titelHoehe + this.bandHoehe() + zeilenHoehe(GROSS) > this.unten) this.neueSeite();
    else this.y += 4;
    this.linie(this.y, NAVY, 0.4);
    this.y += 2;
    this.fliessen(
      this.absatzZeilen(
        [[{ text: 'Übersicht', stil: 'fett' }]],
        RAND,
        this.innen,
        PUNKT_PT,
        0,
        1.5,
      ),
    );
    this.abschnitt('Beschlüsse', u.beschluesse, 'Keine Beschlüsse.');
    this.abschnitt('To-Dos', u.aufgaben, 'Keine To-Dos.');
    this.abschnitt('Termine', u.termine, 'Keine Termine.');
    this.abschnitt(
      'Nächste Sitzung',
      u.naechste ? [{ absatz: [{ text: u.naechste }], punkt: '' }] : [],
      'Noch nicht festgelegt.',
      false,
    );
  }

  private abschnitt(
    titel: string,
    eintraege: readonly UebersichtEintrag[],
    leer: string,
    zahl = true,
  ) {
    const zeilen: FlussZeile[] = [];
    for (const e of eintraege) {
      const absatz: Absatz = e.punkt
        ? [...e.absatz, { text: ` – ${e.punkt}`, stil: 'grau' }]
        : e.absatz;
      const teil = this.absatzZeilen(
        [absatz],
        RAND + ZEICHEN_BREITE + POLSTER_X,
        this.innen - ZEICHEN_BREITE - POLSTER_X,
        GROSS,
        0,
        0.8,
      );
      if (teil[0]) teil[0].zeichen = { z: { art: 'punkt' }, x: RAND + POLSTER_X };
      zeilen.push(...teil);
    }
    if (!zeilen.length)
      zeilen.push(
        ...this.absatzZeilen(
          [[{ text: leer, stil: 'grau' }]],
          RAND + POLSTER_X,
          this.innen - POLSTER_X,
          GROSS,
          0,
          0.8,
        ),
      );
    // Das Band nie allein unten – es wandert mit der ersten Zeile.
    const band = this.bandHoehe();
    if (this.y + band + zeilenHoehe(GROSS) > this.unten) this.neueSeite();
    this.band(titel, zahl ? String(eintraege.length) : null, band);
    this.y += band + 1;
    this.fliessen(zeilen);
    this.y += 2;
  }
}
