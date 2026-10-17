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
import { MARGIN, PAGE_H, PAGE_W, COL_GAP, spaltenBreite, spaltenX } from './blattMasse';

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
  /** `kern` = der Teil selbst; `luecke` = Leerraum dahinter, am Ende des vorigen Stücks gezeigt. */
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
      const luecke = (y0: number, y1: number, verschiebeX: number) => {
        if (y1 > y0)
          out.push({
            seite,
            quelle: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
            ziel: { x: x0 - verschiebeX, y: lueckenZiel },
            art: 'luecke',
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
        // Dahinter bis zum nächsten Stück (der Abstand zwischen zwei Teilen – auf der Rolle genauso)
        // bzw. bis zum Spalten-Ende (die Lücke).
        const bis = i < hier.length - 1 ? hier[i + 1].y0 : PAGE_H;
        luecke(s.y1, bis, verschiebung);
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
): { x: number; y: number } | null {
  const st = liste.find(
    (s) =>
      s.seite === seite &&
      x >= s.quelle.x &&
      x <= s.quelle.x + s.quelle.w &&
      y >= s.quelle.y &&
      y < s.quelle.y + s.quelle.h,
  );
  if (!st) return null;
  return { x: st.ziel.x + (x - st.quelle.x), y: st.ziel.y + (y - st.quelle.y) };
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
): T | null {
  const ziel = a4NachRolle(liste, seite, text.fx * PAGE_W, text.fy * PAGE_H);
  if (!ziel) return null;
  return {
    ...text,
    fx: ziel.x / PAGE_W,
    fy: ziel.y / rollenHoehe,
    sizeCqh: (text.sizeCqh * PAGE_H) / rollenHoehe,
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
): void {
  const q = bild.width / PAGE_W; // Bildpunkte je mm im Bild
  const z = rolleBreitePx / PAGE_W; // Bildpunkte je mm auf der Rolle
  for (const s of liste) {
    if (s.seite !== seite || s.quelle.h <= 0) continue;
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
