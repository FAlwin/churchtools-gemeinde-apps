import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent } from 'react';
import type { usePageDraw, PageTextObj } from '../hooks/usePageDraw';
import { useLatestRef } from '../hooks/useLatestRef';
import {
  OHNE,
  hatInhalt,
  imLasso,
  lassoPfad,
  pixelRahmen,
  imRahmen,
  massstabAusZiehen,
  verwandelterPunkt,
  verwandelterRahmen,
  type Punkt,
  type Rahmen,
  type Verwandlung,
} from '../utils/lasso';
import styles from './LassoEbene.module.scss';

type PageDraw = ReturnType<typeof usePageDraw>;

/** Was vor dem Ausschneiden dazugeholt wurde (Rolle: Anmerkungen aus den Lücken der A4-Seiten). */
export interface Dazugeholt {
  texte: PageTextObj[];
  /** Wurden Striche auf die Leinwand gezeichnet? Dann wird sie gespeichert. */
  striche: boolean;
}

interface LassoEbeneProps {
  /** Die Leinwand mit den eigenen Strichen. */
  leinwandRef: MutableRefObject<HTMLCanvasElement | null>;
  draw: PageDraw;
  /**
   * Vor dem Ausschneiden: weitere Anmerkungen auf die Leinwand holen, die dort noch nicht stehen. Die Rolle
   * holt so, was beim Blättern in einer Lücke gemalt wurde und jetzt über dem nächsten Teil liegt.
   */
  vorAuswahl?: (form: Punkt[]) => Promise<Dazugeholt>;
  /**
   * Darf hier abgelegt werden? Auf der Rolle nur über dem Lied – darunter gäbe es keine A4-Stelle, und das
   * Abgelegte wäre beim Speichern weg. Nein heißt: Hinweis zeigen, die Auswahl schwebt weiter.
   */
  ablegbar?: (z: Rahmen) => boolean;
}

interface Auswahl {
  rahmen: Rahmen;
  /** Die ausgeschnittenen Striche, so groß wie der Rahmen (in Bildpunkten der Leinwand). */
  schwebe: HTMLCanvasElement | null;
  /** Ausgewählte Texte mit ihrer Lage beim Auswählen. */
  texte: Map<number, { fx: number; fy: number; size: number }>;
  /** Leinwand und Speichern zum Zeitpunkt der Auswahl – die Seite kann inzwischen eine andere sein. */
  leinwand: HTMLCanvasElement;
  sichern: (c: HTMLCanvasElement | null) => void;
}

type Geste = { art: 'schieben' | 'groesse'; sx: number; sy: number; start: Verwandlung };

/** Ab so viel Bildpunkten Abstand kommt ein neuer Punkt in die Lasso-Form. */
const PUNKT_ABSTAND_PX = 3;

/**
 * **Lasso** (#615, Alwin 17.10.2026): einkreisen → Striche und Texte darin sind ausgewählt. Im Rahmen ziehen
 * verschiebt, der Griff unten rechts vergrößert (gleichmäßig), ein Tipp daneben legt ab. Rückgängig nimmt
 * die ganze Lasso-Bewegung auf einmal zurück.
 *
 * Ein Baustein für Blättern (`PageDeck`) und Rolle (`RollenMalen`): Er liegt in der Text-Ebene der Seite und
 * rechnet in Anteilen der Fläche. Die Striche werden beim Auswählen aus der Leinwand **ausgeschnitten** und
 * schweben, bis sie abgelegt werden – erst dann wird gespeichert. Texte bewegen sich sofort mit.
 *
 * Abgelegt wird auch, wenn das Werkzeug wechselt, der Stift ausgeht oder weitergeblättert wird (die Ebene
 * verschwindet dann) – mit der Leinwand und dem Schlüssel vom Zeitpunkt der Auswahl.
 */
export function LassoEbene({ leinwandRef, draw, vorAuswahl, ablegbar }: LassoEbeneProps) {
  const ebeneRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState<Punkt[] | null>(null);
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null);
  const [v, setV] = useState<Verwandlung>(OHNE);
  const [hinweis, setHinweis] = useState(false);
  const geste = useRef<Geste | null>(null);
  const zeiger = useRef(new Set<number>());
  // Während des Holens (Rolle) keine zweite Auswahl beginnen.
  const beschaeftigt = useRef(false);

  const live = useLatestRef({
    auswahl,
    v,
    draw,
    uebernehmen: (zwingend: boolean, ausVerlauf = false) => uebernehmen(zwingend, ausVerlauf),
  });

  // Rückgängig/Wiederherstellen/Löschen legen eine schwebende Auswahl zuerst ab.
  useEffect(() => {
    draw.setAbschliessen(auswahl ? () => live.current.uebernehmen(true, true) : null);
  }, [auswahl, draw, live]);
  // Verschwindet die Ebene (anderes Werkzeug, Stift aus, andere Seite): ablegen.
  useEffect(() => {
    const l = live;
    return () => {
      l.current.uebernehmen(true);
      l.current.draw.setAbschliessen(null);
    };
  }, [live]);

  function punkt(e: PointerEvent): Punkt | null {
    const r = ebeneRef.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return null;
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }

  function verwandeln(neu: Verwandlung) {
    const a = live.current.auswahl;
    if (!a) return;
    setV(neu);
    if (a.texte.size === 0) return;
    draw.aendereTexte((alt) =>
      alt.map((o) => {
        const war = a.texte.get(o.id);
        if (!war) return o;
        const p = verwandelterPunkt({ x: war.fx, y: war.fy }, a.rahmen, neu);
        return { ...o, fx: p.x, fy: p.y, sizeCqh: war.size * neu.s };
      }),
    );
  }

  /**
   * Die Auswahl ablegen. Liegt die neue Stelle dort, wo nichts gespeichert würde (`ablegbar`): ohne
   * `zwingend` gar nicht (Hinweis, sie schwebt weiter) – mit `zwingend` (Werkzeugwechsel, Stift aus,
   * Rückgängig) zurück an die alte Stelle. Gibt zurück, ob die Auswahl abgelegt ist.
   *
   * `ausVerlauf`: aufgerufen von Rückgängig/Wiederherstellen/Löschen. Dann bleibt der Lasso-Schritt im
   * Verlauf, auch wenn nichts bewegt wurde – Rückgängig nimmt gleich danach genau ihn zurück. Würde er hier
   * verworfen, träfe Rückgängig den Schritt DAVOR (den Strich selbst).
   */
  function uebernehmen(zwingend: boolean, ausVerlauf = false): boolean {
    const a = live.current.auswahl;
    if (!a) return true;
    let t = live.current.v;
    if (ablegbar && !ablegbar(verwandelterRahmen(a.rahmen, t))) {
      if (!zwingend) {
        setHinweis(true);
        return false;
      }
      t = OHNE;
      verwandeln(OHNE);
    }
    const bewegt = t.dx !== 0 || t.dy !== 0 || t.s !== 1;
    const c = a.leinwand;
    if (a.schwebe) {
      const z = verwandelterRahmen(a.rahmen, t);
      c.getContext('2d')?.drawImage(
        a.schwebe,
        z.x * c.width,
        z.y * c.height,
        z.w * c.width,
        z.h * c.height,
      );
      if (bewegt) a.sichern(c);
    }
    // Nichts bewegt: Die Leinwand steht wieder wie vorher – kein leerer Rückgängig-Schritt.
    if (!bewegt && !ausVerlauf) live.current.draw.dropHistory();
    live.current.auswahl = null;
    live.current.v = OHNE;
    setAuswahl(null);
    setV(OHNE);
    setHinweis(false);
    return true;
  }

  async function auswaehlen(f: Punkt[]) {
    const c = leinwandRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx || !c.width || !c.height) return;
    beschaeftigt.current = true;
    try {
      let texte = live.current.draw.texts;
      if (vorAuswahl) {
        const geholt = await vorAuswahl(f);
        if (geholt.texte.length) {
          texte = [...texte, ...geholt.texte];
          live.current.draw.aendereTexte((alt) => [...alt, ...geholt.texte]);
        }
        if (geholt.striche) live.current.draw.strichSpeicherFuer()(c);
      }
      const W = c.width;
      const H = c.height;
      const { x: bx, y: by, w: bw, h: bh } = pixelRahmen(f, W, H);
      const pfad = lassoPfad(f, W, H, bx, by);

      const schwebe = document.createElement('canvas');
      schwebe.width = bw;
      schwebe.height = bh;
      const sc = schwebe.getContext('2d');
      if (!sc) return;
      sc.drawImage(c, bx, by, bw, bh, 0, 0, bw, bh);
      sc.globalCompositeOperation = 'destination-in';
      sc.fill(pfad);
      const mitStrichen = hatInhalt(schwebe);
      const gewaehlt = texte.filter((o) => imLasso({ x: o.fx, y: o.fy }, f));
      if (!mitStrichen && gewaehlt.length === 0) return;

      live.current.draw.pushHistory(texte);
      if (mitStrichen) {
        ctx.save();
        ctx.translate(bx, by);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fill(pfad);
        ctx.restore();
      }
      const neu: Auswahl = {
        rahmen: { x: bx / W, y: by / H, w: bw / W, h: bh / H },
        schwebe: mitStrichen ? schwebe : null,
        texte: new Map(gewaehlt.map((o) => [o.id, { fx: o.fx, fy: o.fy, size: o.sizeCqh }])),
        leinwand: c,
        sichern: live.current.draw.strichSpeicherFuer(),
      };
      live.current.auswahl = neu;
      setAuswahl(neu);
      setV(OHNE);
    } finally {
      beschaeftigt.current = false;
    }
  }

  function runter(e: PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    zeiger.current.add(e.pointerId);
    // Zweiter Finger = Zoomen/Scrollen: die angefangene Form verwerfen.
    if (zeiger.current.size > 1) {
      setForm(null);
      geste.current = null;
      return;
    }
    if (beschaeftigt.current) return;
    const p = punkt(e);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (auswahl && imRahmen(p, verwandelterRahmen(auswahl.rahmen, v))) {
      geste.current = { art: 'schieben', sx: p.x, sy: p.y, start: v };
      return;
    }
    // Daneben getippt: ablegen – oder, wo es nicht geht, Hinweis und keine neue Form.
    if (auswahl && !uebernehmen(false)) return;
    setForm([p]);
  }

  function griffRunter(e: PointerEvent<HTMLSpanElement>) {
    e.stopPropagation();
    zeiger.current.add(e.pointerId);
    const p = punkt(e);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    geste.current = { art: 'groesse', sx: p.x, sy: p.y, start: v };
  }

  function bewegen(e: PointerEvent) {
    const p = punkt(e);
    if (!p) return;
    const g = geste.current;
    if (g && auswahl) {
      setHinweis(false);
      if (g.art === 'schieben') {
        verwandeln({ ...g.start, dx: g.start.dx + p.x - g.sx, dy: g.start.dy + p.y - g.sy });
      } else {
        const r = ebeneRef.current?.getBoundingClientRect();
        const verhaeltnis = r && r.height ? r.width / r.height : 1;
        const s = massstabAusZiehen(auswahl.rahmen, g.start, p.x - g.sx, p.y - g.sy, verhaeltnis);
        verwandeln({ ...g.start, s });
      }
      return;
    }
    if (!form) return;
    const r = ebeneRef.current?.getBoundingClientRect();
    const letzter = form[form.length - 1];
    if (
      r &&
      Math.hypot((p.x - letzter.x) * r.width, (p.y - letzter.y) * r.height) < PUNKT_ABSTAND_PX
    )
      return;
    setForm([...form, p]);
  }

  function hoch(e: PointerEvent) {
    e.stopPropagation();
    zeiger.current.delete(e.pointerId);
    if (geste.current) {
      geste.current = null;
      return;
    }
    const f = form;
    setForm(null);
    if (f && f.length >= 3) void auswaehlen(f);
  }

  function abbrechen(e: PointerEvent) {
    zeiger.current.delete(e.pointerId);
    geste.current = null;
    setForm(null);
  }

  const z = auswahl ? verwandelterRahmen(auswahl.rahmen, v) : null;
  const prozent = (n: number) => `${n * 100}%`;

  return (
    <div
      ref={ebeneRef}
      className={styles.ebene}
      data-testid="lasso-ebene"
      onPointerDown={runter}
      onPointerMove={bewegen}
      onPointerUp={hoch}
      onPointerCancel={abbrechen}
    >
      {auswahl?.schwebe && z && (
        <div
          className={styles.schwebe}
          style={{
            left: prozent(z.x),
            top: prozent(z.y),
            width: prozent(z.w),
            height: prozent(z.h),
          }}
          ref={(n) => {
            const s = auswahl.schwebe;
            if (n && s && n.firstChild !== s) n.replaceChildren(s);
          }}
        />
      )}
      {z && (
        <div
          className={styles.rahmen}
          data-testid="lasso-auswahl"
          style={{
            left: prozent(z.x),
            top: prozent(z.y),
            width: prozent(z.w),
            height: prozent(z.h),
          }}
        >
          <span
            className={styles.griff}
            aria-label="Auswahl vergrößern oder verkleinern"
            data-testid="lasso-griff"
            onPointerDown={griffRunter}
            onPointerMove={bewegen}
            onPointerUp={hoch}
            onPointerCancel={abbrechen}
          />
          {hinweis && (
            <span className={styles.hinweis} role="status">
              Hier wird nichts gespeichert – bitte aufs Lied schieben
            </span>
          )}
        </div>
      )}
      {form && form.length > 1 && (
        <svg className={styles.form} viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
          <polygon points={form.map((p) => `${p.x},${p.y}`).join(' ')} />
        </svg>
      )}
    </div>
  );
}
