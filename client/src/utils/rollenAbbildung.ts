/**
 * **Anmerkungen zwischen A4 und Rolle umrechnen** (#614, Alwin 17.10.2026: „einmal malen, in beiden
 * Ansichten sehen").
 *
 * Die Anmerkungen bleiben auf den A4-Seiten gespeichert (wie bisher, Konto-Abgleich und Team-Notizen
 * unverändert). Die Rolle des Scroll-Modus (#607) zeigt sie umgerechnet. Möglich ist das, weil die Rolle
 * mit DERSELBEN Funktion gesetzt wird wie A4 – bei einer Spalte stehen die Zeilen dort exakt gleich, nur
 * ohne Seitenwechsel. Beim Setzen schreibt `generateChordPdf` jedes **Stück** mit (ein Teil, eine Spalte,
 * eine Seite); hier wird daraus die Zuordnung.
 *
 * Entscheidungen (Alwin, 17.10.2026):
 * - **Lücken** (Rest einer Spalte nach dem letzten Teil, oberer Rand ab Seite 2, leere Spalte, Raum über
 *   der CCLI-Zeile): Was dort gemalt ist, zeigt die Rolle **am Ende des vorigen Stücks** – es darf dort
 *   über dem nächsten Teil liegen; zurechtrücken mit dem Lasso (#615).
 * - **2 Spalten:** Die Zeilen sind auf A4 anders umbrochen. Übertragen wird trotzdem – Stück für Stück,
 *   an den linken Rand gerückt. Das steht dann ungefähr, nicht genau.
 *
 * Alle Angaben in mm; die Rolle ist so breit wie A4.
 */
import {
  KOPF_ABSTAND,
  MARGIN,
  PAGE_H,
  PAGE_W,
  COL_GAP,
  spaltenBreite,
  spaltenX,
} from './blattMasse';

/** Ein zusammenhängender Lauf eines Teils in einer Spalte einer Seite. */
export interface Stueck {
  /** Stelle des Teils in der angezeigten Reihenfolge (Flow). */
  teil: number;
  seite: number;
  spalte: number;
  /** Linker Rand der Spalte. */
  x: number;
  y0: number;
  y1: number;
  /** Wie weit der Teil vor diesem Stück schon gelaufen war (bei Umbruch mitten im Teil > 0). */
  imTeil: number;
}

/** Was ein Satz-Durchlauf über die Lage der Teile weiß. */
export interface Satzplan {
  stuecke: Stueck[];
  /**
   * Wo ein Weiterschalt-Punkt `----` steht (#606/#609): Seite und Höhe der Zeile danach, in mm. Auf der
   * Rolle hält das Pedal dort an (`pedalHalte`).
   */
  weiterschalten: { seite: number; y: number }[];
  /** Wo unter dem Titelkopf die Teile beginnen (Seite 1). */
  kopfEnde: number;
  spalten: number;
  seiten: number;
}

/** A4-Satz und Rollen-Satz desselben Lieds. */
export interface Abbildung {
  a4: Satzplan;
  rolle: Satzplan & { hoehe: number };
}

export interface Rechteck {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ein Streifen einer A4-Seite und wohin er auf der Rolle gehört. */
export interface Streifen {
  seite: number;
  quelle: Rechteck;
  ziel: { x: number; y: number };
  /**
   * `kern` = steht auf der Rolle genau so (ein Teil, der Titelkopf, der Abstand zum nächsten Teil in
   * derselben Spalte oder der Platz unter dem letzten Teil, #626); `luecke` = Leerraum am Spalten-/Seitenende,
   * am Ende des vorigen Stücks gezeigt – dort kann er über dem nächsten Teil liegen. Gemalt wird auf der
   * Rolle nur in Kernen (#608).
   */
  art: 'kern' | 'luecke';
}

/** Wo der Teil `teil` auf der Rolle beginnt. */
function rollenAnfang(abb: Abbildung, teil: number): number {
  const s = abb.rolle.stuecke.find((r) => r.teil === teil);
  return s ? s.y0 - s.imTeil : abb.rolle.kopfEnde;
}

/** Waagerechter Bereich einer A4-Spalte – bis zur Mitte des Zwischenraums, außen bis zum Rand. */
function spaltenBereich(spalte: number, spalten: number): { x0: number; x1: number } {
  const x = spaltenX(spalte, spalten);
  return {
    x0: spalte === 0 ? 0 : x - COL_GAP / 2,
    x1: spalte === spalten - 1 ? PAGE_W : x + spaltenBreite(spalten) + COL_GAP / 2,
  };
}

/**
 * Alle Streifen der A4-Seiten mit ihrem Ziel auf der Rolle – lückenlos: Jede Stelle einer A4-Seite liegt
 * in genau einem Streifen (der Titelkopf, ein Kern oder eine Lücke).
 */
export function streifen(abb: Abbildung): Streifen[] {
  const { a4 } = abb;
  const out: Streifen[] = [];
  // Das letzte Stück des Lieds (Satz-Reihenfolge): Der Platz darunter ist auf der Rolle frei – dort steht er
  // genauso wie auf A4, also als Kern (#626). Die Rolle wächst, wenn dort etwas steht (`rollenUnterkante`).
  const letztes = a4.stuecke[a4.stuecke.length - 1];
  // Titelkopf: auf beiden gleich – er steht oben auf der ersten Seite bzw. der Rolle.
  out.push({
    seite: 0,
    quelle: { x: 0, y: 0, w: PAGE_W, h: a4.kopfEnde },
    ziel: { x: 0, y: 0 },
    art: 'kern',
  });
  /** Wohin eine Lücke kommt: ans Ende des zuletzt gesetzten Stücks (auf der Rolle). */
  let lueckenZiel = abb.rolle.kopfEnde;
  for (let seite = 0; seite < a4.seiten; seite++) {
    for (let spalte = 0; spalte < a4.spalten; spalte++) {
      const { x0, x1 } = spaltenBereich(spalte, a4.spalten);
      const oben = seite === 0 ? a4.kopfEnde : 0;
      const hier = a4.stuecke
        .filter((s) => s.seite === seite && s.spalte === spalte)
        .sort((a, b) => a.y0 - b.y0);
      const luecke = (
        y0: number,
        y1: number,
        verschiebeX: number,
        art: Streifen['art'] = 'luecke',
      ) => {
        if (y1 > y0)
          out.push({
            seite,
            quelle: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
            ziel: { x: x0 - verschiebeX, y: lueckenZiel },
            art,
          });
      };
      const verschiebung = spaltenX(spalte, a4.spalten) - MARGIN;
      if (hier.length === 0) {
        luecke(oben, PAGE_H, verschiebung);
        continue;
      }
      // Über dem ersten Stück (oberer Rand ab Seite 2): gehört zur Lücke davor.
      luecke(oben, hier[0].y0, verschiebung);
      hier.forEach((s, i) => {
        const ziel = rollenAnfang(abb, s.teil) + s.imTeil;
        out.push({
          seite,
          quelle: { x: x0, y: s.y0, w: x1 - x0, h: s.y1 - s.y0 },
          ziel: { x: x0 - verschiebung, y: ziel },
          art: 'kern',
        });
        lueckenZiel = ziel + (s.y1 - s.y0);
        // Dahinter bis zum nächsten Stück – der Abstand zwischen zwei Teilen steht auf der Rolle genauso
        // (also ein Kern) – bzw. bis zum Spalten-Ende (die echte Lücke).
        if (i < hier.length - 1) luecke(s.y1, hier[i + 1].y0, verschiebung, 'kern');
        else luecke(s.y1, PAGE_H, verschiebung, s === letztes ? 'kern' : 'luecke');
      });
    }
  }
  return out;
}

/** Ein Punkt einer A4-Seite (mm) auf der Rolle (mm) – über den Streifen, in dem er liegt. */
export function a4NachRolle(
  liste: Streifen[],
  seite: number,
  x: number,
  y: number,
): { x: number; y: number; art: Streifen['art'] } | null {
  const st = liste.find(
    (s) =>
      s.seite === seite &&
      x >= s.quelle.x &&
      x <= s.quelle.x + s.quelle.w &&
      y >= s.quelle.y &&
      y < s.quelle.y + s.quelle.h,
  );
  if (!st) return null;
  return { x: st.ziel.x + (x - st.quelle.x), y: st.ziel.y + (y - st.quelle.y), art: st.art };
}

/**
 * **Zurück: ein Punkt der Rolle auf seine A4-Seite** (#608 – was auf der Rolle gemalt wird, wird auf den
 * A4-Seiten gespeichert). Nur über Kerne: Die sind auf der Rolle überschneidungsfrei, eine Lücke dagegen
 * liegt dort über dem nächsten Teil und wäre mehrdeutig. Liegt der Punkt in keinem Kern (rechts neben
 * einem schmalen 2-Spalten-Streifen, tiefer als der Platz unter dem letzten Teil), zählt der nächstgelegene.
 */
export function rolleNachA4(
  liste: Streifen[],
  x: number,
  y: number,
): { seite: number; x: number; y: number } | null {
  const kerne = liste.filter((s) => s.art === 'kern' && s.quelle.h > 0);
  if (kerne.length === 0) return null;
  const innen = (s: Streifen) =>
    x >= s.ziel.x && x < s.ziel.x + s.quelle.w && y >= s.ziel.y && y < s.ziel.y + s.quelle.h;
  const abstand = (s: Streifen) => {
    const dy =
      y < s.ziel.y ? s.ziel.y - y : y >= s.ziel.y + s.quelle.h ? y - (s.ziel.y + s.quelle.h) : 0;
    const dx =
      x < s.ziel.x ? s.ziel.x - x : x >= s.ziel.x + s.quelle.w ? x - (s.ziel.x + s.quelle.w) : 0;
    return dy * 1000 + dx; // erst die Höhe, dann die Seite
  };
  const st = kerne.find(innen) ?? [...kerne].sort((a, b) => abstand(a) - abstand(b))[0];
  const klemme = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    seite: st.seite,
    x: klemme(st.quelle.x + (x - st.ziel.x), st.quelle.x, st.quelle.x + st.quelle.w),
    y: klemme(st.quelle.y + (y - st.ziel.y), st.quelle.y, st.quelle.y + st.quelle.h - 0.01),
  };
}

/** Was eine Seite des Scroll-Modus an Anmerkungen zeigt: eine Seite selbst oder – bei der Rolle – alle
 * A4-Seiten des Lieds, umgerechnet. Je Seite die eigene Ebene und die gerade angesehene fremde. */
export interface Anmerkungsquelle {
  seiten: { own: string | null; over: string | null }[];
  /** Nur bei der Rolle: wo A4 und Rolle was stehen haben. */
  abbildung?: Abbildung;
}

/**
 * Ein Textfeld einer A4-Seite auf der Rolle. Die Größe ist in `cqh` gespeichert – Prozent der
 * SEITENhöhe; auf der viel höheren Rolle muss sie umgerechnet werden, sonst würde der Text riesig.
 * `null`, wenn der Punkt in keinem Streifen liegt (kommt nicht vor – die Streifen decken alles ab).
 */
export function textAufRolle<T extends { fx: number; fy: number; sizeCqh: number }>(
  text: T,
  liste: Streifen[],
  seite: number,
  rollenHoehe: number,
): (T & { art: Streifen['art'] }) | null {
  const ziel = a4NachRolle(liste, seite, text.fx * PAGE_W, text.fy * PAGE_H);
  if (!ziel) return null;
  return {
    ...text,
    fx: ziel.x / PAGE_W,
    fy: ziel.y / rollenHoehe,
    sizeCqh: (text.sizeCqh * PAGE_H) / rollenHoehe,
    art: ziel.art,
  };
}

/** So viel Platz bleibt unter der untersten Anmerkung, wenn die Rolle für sie wächst (mm, #626). */
export const ROLLEN_RAND_UNTEN = 6;

/**
 * **Wie weit die Anmerkungen einer A4-Seite auf der Rolle nach unten reichen** (mm, #626). Unter dem letzten
 * Teil hat A4 oft noch Platz, die Rolle aber endet mit dem Lied – was dort gemalt oder geschrieben ist,
 * stünde sonst hinter dem Liedende (unsichtbar bzw. über dem nächsten Lied). Die Rolle wächst bis hierher.
 *
 * `belegtBis(q)` sagt, bis wohin (mm, A4) in diesem Bereich der Seite Striche stehen (`null` = keine); gefragt
 * wird nur für Bereiche, die auf der Rolle unter `ab` reichen – darüber ist die Rolle ohnehin lang genug.
 * Texte stehen mit ihrer Mitte bei `fy` (`.textObj`), ihre Höhe folgt aus Größe und Zeilenzahl. 0 = nichts.
 */
export function rollenUnterkante(
  liste: Streifen[],
  seite: number,
  ab: number,
  belegtBis: (q: Rechteck) => number | null,
  texte: readonly { fx: number; fy: number; sizeCqh: number; text: string }[],
): number {
  let unten = 0;
  for (const s of liste) {
    // (Rundung: Das Ende eines Stücks liegt auf der Rolle nicht aufs letzte Bit genau auf `ab`.)
    if (s.seite !== seite || s.quelle.h <= 0 || s.ziel.y + s.quelle.h <= ab + 1e-6) continue;
    const bis = belegtBis(s.quelle);
    if (bis !== null) unten = Math.max(unten, s.ziel.y + (bis - s.quelle.y));
  }
  for (const t of texte) {
    const mitte = a4NachRolle(liste, seite, t.fx * PAGE_W, t.fy * PAGE_H);
    if (!mitte) continue;
    // Zeilenhöhe 1.15 und etwas Innenabstand wie `.textObj`.
    const hoch = (t.sizeCqh / 100) * PAGE_H * (t.text.split('\n').length * 1.15 + 0.4);
    unten = Math.max(unten, mitte.y + hoch / 2);
  }
  return unten;
}

/** Umgekehrt: ein Textfeld der Rolle auf seine A4-Seite – Lage und Größe (#608). */
export function textAufSeite<T extends { fx: number; fy: number; sizeCqh: number }>(
  text: T,
  liste: Streifen[],
  rollenHoehe: number,
): { seite: number; text: T } | null {
  const ziel = rolleNachA4(liste, text.fx * PAGE_W, text.fy * rollenHoehe);
  if (!ziel) return null;
  return {
    seite: ziel.seite,
    text: {
      ...text,
      fx: ziel.x / PAGE_W,
      fy: ziel.y / PAGE_H,
      sizeCqh: (text.sizeCqh * rollenHoehe) / PAGE_H,
    },
  };
}

/**
 * Die Striche einer A4-Seite (gespeichertes Bild) Streifen für Streifen auf die Rolle zeichnen. Bild und
 * Rolle können verschieden scharf gezeichnet sein (Leinwand-Deckel) – deshalb je eigener Maßstab.
 */
export function stricheAufRolle(
  ctx: CanvasRenderingContext2D,
  bild: CanvasImageSource & { width: number },
  liste: Streifen[],
  seite: number,
  rolleBreitePx: number,
  nur?: Streifen['art'],
): void {
  const q = bild.width / PAGE_W; // Bildpunkte je mm im Bild
  const z = rolleBreitePx / PAGE_W; // Bildpunkte je mm auf der Rolle
  for (const s of liste) {
    if (s.seite !== seite || s.quelle.h <= 0 || (nur && s.art !== nur)) continue;
    ctx.drawImage(
      bild,
      s.quelle.x * q,
      s.quelle.y * q,
      s.quelle.w * q,
      s.quelle.h * q,
      s.ziel.x * z,
      s.ziel.y * z,
      s.quelle.w * z,
      s.quelle.h * z,
    );
  }
}

/**
 * **Zurück: die Kerne der Rolle in eine A4-Seite schreiben** (#608). Jeder Kern dieser Seite wird auf der
 * Seite geleert und aus der Rolle neu gefüllt – Lücken bleiben unberührt (die werden auf der Rolle nicht
 * bearbeitet). `ctx` gehört zur Leinwand der A4-Seite, mit den bisherigen Strichen darauf.
 */
export function kerneAufSeite(
  ctx: CanvasRenderingContext2D,
  rolle: CanvasImageSource & { width: number; height: number },
  liste: Streifen[],
  seite: number,
  seiteBreitePx: number,
): void {
  const q = seiteBreitePx / PAGE_W; // Bildpunkte je mm auf der A4-Seite
  const z = rolle.width / PAGE_W; // Bildpunkte je mm auf der Rolle
  const rollenEnde = rolle.height / z; // mm
  for (const s of liste) {
    if (s.seite !== seite || s.art !== 'kern' || s.quelle.h <= 0) continue;
    // Nur, was die Rolle auch zeigt: Der Platz unter dem letzten Teil (#626) kann länger sein als die Rolle –
    // was darunter auf A4 steht, darf beim Zurückschreiben nicht geleert werden.
    const h = Math.min(s.quelle.h, rollenEnde - s.ziel.y);
    if (h <= 0) continue;
    ctx.clearRect(s.quelle.x * q, s.quelle.y * q, s.quelle.w * q, h * q);
    ctx.drawImage(
      rolle,
      s.ziel.x * z,
      s.ziel.y * z,
      s.quelle.w * z,
      h * z,
      s.quelle.x * q,
      s.quelle.y * q,
      s.quelle.w * q,
      h * q,
    );
  }
}

/**
 * **Wird auf der Rolle hier gespeichert?** (#615) Nur was über einem Kern steht, kommt zurück auf eine
 * A4-Seite (`kerneAufSeite`). Bei 2-Spalten-Liedern rechts neben dem schmalen Streifen – und tiefer, als die
 * A4-Seite unter dem letzten Teil Platz hat – gäbe es kein Ziel; ein Strich dort wäre beim Speichern weg. Das Lasso legt deshalb nur ab, wo
 * der ganze Rahmen auf Kernen liegt (geprüft an einem Raster von Punkten, Angaben in mm).
 */
export function rahmenAufKernen(liste: Streifen[], r: Rechteck, raster = 6): boolean {
  const kerne = liste.filter((s) => s.art === 'kern' && s.quelle.h > 0);
  const aufKern = (x: number, y: number) =>
    kerne.some(
      (s) =>
        x >= s.ziel.x && x <= s.ziel.x + s.quelle.w && y >= s.ziel.y && y <= s.ziel.y + s.quelle.h,
    );
  for (let i = 0; i <= raster; i++)
    for (let j = 0; j <= raster; j++)
      if (!aufKern(r.x + (r.w * i) / raster, r.y + (r.h * j) / raster)) return false;
  return true;
}

/** Luft über einem angesprungenen Teil (mm, #609) – die Überschrift klebt nicht an der Kante. */
export const HALTE_LUFT = 2;

/**
 * **Wo das Pedal auf der Rolle anhält** (#609, Alwin 17.10.2026: „Teil für Teil“): der Titel (Anfang der
 * Rolle), der Anfang jedes Teils und jeder Weiterschalt-Punkt `----` – sortiert, in mm von oben, als
 * Oberkante des Bildschirms. Ein Teil, der im Flow wiederkehrt, hält bei jedem Vorkommen.
 *
 * Über einem Teil bleibt `HALTE_LUFT` frei, höchstens aber die Hälfte des Abstands zum Teil davor bzw. zum
 * Titelkopf – sonst schaut dessen letzte Zeile als Streifen herein (Alwin 19.10.2026). In mm, damit die
 * Luft mit der Bildschirmbreite wächst und schrumpft wie der Abstand selbst; feste Bildpunkte waren auf
 * schmalen Handys größer als der Abstand. Am `----` stoßen zwei Zeilen aneinander: dort keine Luft.
 */
export function pedalHalte(abb: Abbildung): number[] {
  const { rolle } = abb;
  // Die Rolle hat eine Spalte: Davor steht das Stück mit dem größten Ende darüber, sonst der Titelkopf.
  const ueber = (y0: number) =>
    Math.max(
      rolle.kopfEnde - KOPF_ABSTAND,
      ...rolle.stuecke.filter((s) => s.y1 <= y0).map((s) => s.y1),
    );
  const stellen = [
    0,
    ...rolle.stuecke
      .filter((s) => s.imTeil === 0)
      .map((s) => s.y0 - Math.min(HALTE_LUFT, (s.y0 - ueber(s.y0)) / 2)),
    ...rolle.weiterschalten.map((w) => w.y),
  ];
  return [...new Set(stellen)].sort((a, b) => a - b);
}
