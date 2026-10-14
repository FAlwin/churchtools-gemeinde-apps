import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import type { PageTextObj } from '../hooks/usePageDraw';
import { useLatestRef } from '../hooks/useLatestRef';
import { readPageTexts } from '../utils/annotationKeys';
import { textObjStyle } from '../utils/textObjStyle';
import type { PedalRichtung } from '../utils/pedalTasten';
import { SCHRITT_ANTEIL, type ScrollPosition } from '../utils/scrollPosition';
import { Spinner } from './Spinner';
import deck from './PageDeck.module.scss';
import styles from './ScrollDeck.module.scss';

interface ScrollDeckProps {
  /** Dieselben fertig gerenderten Seiten wie beim Blättern. */
  pages: HTMLCanvasElement[];
  loading: boolean;
  error: string | null;
  loadingLabel: string;
  /** Eigene Anmerkungen einer Seite – `null`, wenn sie gerade nicht gezeigt werden (Notizen von …). */
  ownKeyFor: (page: number) => string | null;
  /** Gerade angesehene fremde Ebene einer Seite (nur lesend) – oder `null`. */
  overlayKeyFor: (page: number) => string | null;
  /** Die sichtbare Seite laut Navigation. Weicht sie von der gemeldeten ab (Tipp auf einen Lied-Punkt), wird sie nach oben geholt. */
  seite: number;
  /** Meldet, welche Seite gerade in der Bildmitte steht. */
  onSeite: (page: number) => void;
  /** Die Position wird hier mitgeschrieben – zum Zurückkehren nach dem Malen und nach Neuaufbau. */
  positionRef: MutableRefObject<ScrollPosition>;
  /** Tipp aufs Blatt: Leisten aus/ein (Alwin, 14.10.2026: überall, nicht nur in der Mitte). */
  onTipp?: () => void;
  /** Erhöht sich nach einem Abgleich der Anmerkungen → neu zeichnen. */
  syncTick?: number;
  /** Hier legt die Ansicht ihren Pedal-Schritt ab (die Navigation ruft ihn bei einer Pedal-Taste). */
  schrittRef: MutableRefObject<((richtung: PedalRichtung) => void) | null>;
}

/**
 * **Scroll-Modus** (#551, Dev-Stammtisch 14.10.2026): alle Seiten des Ablaufs untereinander, jede in
 * voller Breite – auch quer am iPad, dort wird die Schrift dadurch deutlich größer als im 2-up.
 *
 * Bewusst **nur zum Lesen**: Es sind dieselben Seiten wie beim Blättern, nur aneinandergehängt. Die
 * Anmerkungen hängen weiter an ihrer Seite und werden mitgezeichnet; nichts wird umgerechnet. Zum
 * Malen öffnet die Chart-Ansicht die gerade sichtbare Seite in der gewohnten Einzelansicht
 * (`PageDeck` mit `einzeln`) und kehrt danach an dieselbe Stelle zurück (Entscheidung Alwin) – der
 * Mal-Kern mit Textfeldern, Tastatur und Rückgängig bleibt so EINE Stelle.
 *
 * Speicher: Nur Seiten in der Nähe des Bildschirms bekommen eine Leinwand; weiter entfernte werden
 * freigegeben. Zwanzig Seiten in voller Auflösung gleichzeitig wären auf älteren iPads zu viel.
 */
export function ScrollDeck({
  pages,
  loading,
  error,
  loadingLabel,
  ownKeyFor,
  overlayKeyFor,
  seite,
  onSeite,
  positionRef,
  onTipp,
  syncTick = 0,
  schrittRef,
}: ScrollDeckProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const seitenRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Die zuletzt GEMELDETE Seite – weicht `seite` davon ab, kam der Wunsch von außen (Lied-Punkt).
  const gemeldet = useRef<number>(positionRef.current.mitte);
  const onSeiteRef = useLatestRef(onSeite);
  const [merker, setMerker] = useState<{ top: number; n: number } | null>(null);

  /** Oberkante einer Seite im Scroll-Inhalt. */
  const oben = (p: number): number => seitenRefs.current[p]?.offsetTop ?? 0;

  function springeZu(pos: ScrollPosition) {
    const el = rootRef.current;
    if (!el) return;
    el.scrollTop = oben(pos.seite) + pos.versatz;
  }

  // Beim Aufbau und nach jedem Neuaufbau der Seiten (z. B. anderes Arrangement): zurück an die
  // gemerkte Stelle – VOR dem Zeichnen, damit nichts sichtbar springt.
  useLayoutEffect(() => {
    if (loading || pages.length === 0) return;
    const pos = positionRef.current;
    springeZu({ ...pos, seite: Math.min(pos.seite, pages.length - 1) });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei neuem Seitenstand, nicht bei jeder Position
  }, [loading, pages]);

  // Wunsch von außen (Tipp auf einen Lied-Punkt): an den Anfang dieser Seite.
  useEffect(() => {
    if (loading || seite === gemeldet.current) return;
    gemeldet.current = seite;
    positionRef.current = { seite, versatz: 0, mitte: seite };
    springeZu(positionRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- springeZu liest nur Refs
  }, [seite, loading, positionRef]);

  // Mitlesen, welche Seite oben steht (einmal je Bild, nicht je Scroll-Ereignis).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let rahmen = 0;
    const lesen = () => {
      rahmen = 0;
      const y = el.scrollTop;
      const ymitte = y + el.clientHeight / 2;
      let p = 0;
      let m = 0;
      for (let i = 0; i < seitenRefs.current.length; i++) {
        const o = oben(i);
        if (o <= y + 1) p = i;
        if (o <= ymitte) m = i;
        else break;
      }
      positionRef.current = { seite: p, versatz: Math.max(0, y - oben(p)), mitte: m };
      if (m !== gemeldet.current) {
        gemeldet.current = m;
        onSeiteRef.current(m);
      }
    };
    const beimScrollen = () => {
      if (!rahmen) rahmen = requestAnimationFrame(lesen);
    };
    el.addEventListener('scroll', beimScrollen, { passive: true });
    return () => {
      el.removeEventListener('scroll', beimScrollen);
      if (rahmen) cancelAnimationFrame(rahmen);
    };
  }, [onSeiteRef, positionRef]);

  // Pedal: ein Schritt von ⅔ Bildschirmhöhe; vorwärts zeigt eine Linie kurz die alte Unterkante.
  useEffect(() => {
    schrittRef.current = (richtung) => {
      const el = rootRef.current;
      if (!el) return;
      const h = el.clientHeight;
      const amEnde = el.scrollTop + h >= el.scrollHeight - 2;
      if (richtung === 1 && !amEnde)
        setMerker((m) => ({ top: el.scrollTop + h, n: (m?.n ?? 0) + 1 }));
      const ruhig = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollTo({
        top: el.scrollTop + richtung * Math.round(h * SCHRITT_ANTEIL),
        behavior: ruhig ? 'auto' : 'smooth',
      });
    };
    return () => {
      schrittRef.current = null;
    };
  }, [schrittRef]);

  return (
    <div ref={rootRef} className={styles.root} data-testid="scroll-deck" onClick={() => onTipp?.()}>
      {loading && (
        <div className={deck.center}>
          <Spinner />
          <span>{loadingLabel}</span>
        </div>
      )}
      {error && <div className={deck.center}>⚠️ {error}</div>}
      {!loading && (
        <div className={styles.inhalt}>
          {pages.map((src, p) => (
            <ScrollSeite
              key={p}
              src={src}
              root={rootRef}
              ownKey={ownKeyFor(p)}
              overlayKey={overlayKeyFor(p)}
              syncTick={syncTick}
              seitenRef={(n) => {
                seitenRefs.current[p] = n;
              }}
            />
          ))}
          {merker && (
            <div key={merker.n} className={styles.merker} style={{ top: merker.top }} aria-hidden />
          )}
        </div>
      )}
    </div>
  );
}

interface ScrollSeiteProps {
  src: HTMLCanvasElement;
  root: MutableRefObject<HTMLDivElement | null>;
  ownKey: string | null;
  overlayKey: string | null;
  syncTick: number;
  seitenRef: (n: HTMLDivElement | null) => void;
}

/** Bild aus einem gespeicherten Strich-PNG – fertig dekodiert oder `null`. */
function ladeBild(key: string | null): Promise<HTMLImageElement | null> {
  let daten: string | null = null;
  try {
    daten = key ? localStorage.getItem(key) : null;
  } catch {
    daten = null;
  }
  if (!daten) return Promise.resolve(null);
  return new Promise((fertig) => {
    const img = new Image();
    img.onload = () => fertig(img);
    img.onerror = () => fertig(null);
    img.src = daten;
  });
}

/**
 * Eine Seite im Scroll-Modus: Seite, fremde Striche, eigene Striche (in DIESER Reihenfolge wie beim
 * Blättern, `composePane`) und darüber die Texte – mit demselben Stil wie in der Live-Ansicht
 * (`textObjStyle`, #113).
 */
function ScrollSeite({ src, root, ownKey, overlayKey, syncTick, seitenRef }: ScrollSeiteProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [nah, setNah] = useState(false);

  // Nur in der Nähe des Bildschirms (eine Bildschirmhöhe davor und danach) wird gezeichnet.
  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof IntersectionObserver === 'undefined') {
      setNah(true);
      return;
    }
    const io = new IntersectionObserver((e) => setNah(e.some((x) => x.isIntersecting)), {
      root: root.current,
      rootMargin: '100% 0px',
    });
    io.observe(box);
    return () => io.disconnect();
  }, [root]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    if (!nah) {
      // Freigeben – die Seite behält ihren Platz über das Seitenverhältnis.
      c.width = 0;
      c.height = 0;
      return;
    }
    let aktuell = true;
    void Promise.all([ladeBild(overlayKey), ladeBild(ownKey)]).then(([fremd, eigen]) => {
      if (!aktuell) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      c.width = src.width;
      c.height = src.height;
      ctx.drawImage(src, 0, 0);
      if (fremd) ctx.drawImage(fremd, 0, 0);
      if (eigen) ctx.drawImage(eigen, 0, 0);
    });
    return () => {
      aktuell = false;
    };
  }, [nah, src, ownKey, overlayKey, syncTick]);

  const texte = useMemo(
    () => [...readPageTexts<PageTextObj>(overlayKey), ...readPageTexts<PageTextObj>(ownKey)],
    // syncTick ist das Signal, dass sich der Speicher geändert hat (wie in PageDeck).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overlayKey, ownKey, syncTick],
  );

  const seitenformat = `${src.width} / ${src.height}`;
  return (
    <div
      ref={(n) => {
        boxRef.current = n;
        seitenRef(n);
      }}
      className={styles.seite}
      style={{ aspectRatio: seitenformat }}
    >
      <canvas ref={canvasRef} className={styles.leinwand} />
      {texte.length > 0 && (
        <div className={styles.textEbene}>
          {texte.map((o) => (
            <div key={o.id} className={deck.textObj} style={textObjStyle(o)}>
              {o.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
