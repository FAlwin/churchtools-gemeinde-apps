import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { Icon } from '@ui/icons/icons';
import type { PageTextObj } from '../hooks/usePageDraw';
import type { DrawTool } from '../types/index';
import { RollenMalen } from './RollenMalen';
import { useLatestRef } from '../hooks/useLatestRef';
import { readPageTexts } from '../utils/annotationKeys';
import { textObjStyle } from '../utils/textObjStyle';
import type { PedalRichtung } from '../utils/pedalTasten';
import type { ScrollPosition } from '../utils/scrollPosition';
import { pedalZiel } from '../utils/pedalSchritt';
import {
  pedalHalte,
  ROLLEN_RAND_UNTEN,
  rollenUnterkante,
  stricheAufRolle,
  streifen,
  textAufRolle,
  type Anmerkungsquelle,
  type Rechteck,
} from '../utils/rollenAbbildung';
import { PAGE_W } from '../utils/blattMasse';
import { Spinner } from './Spinner';
import deck from './PageDeck.module.scss';
import styles from './ScrollDeck.module.scss';

interface ScrollDeckProps {
  /** Dieselben fertig gerenderten Seiten wie beim Blättern. */
  pages: HTMLCanvasElement[];
  loading: boolean;
  error: string | null;
  loadingLabel: string;
  /**
   * Welche Anmerkungen eine Seite zeigt – eigene und gerade angesehene fremde. Bei der Rolle die ALLER
   * A4-Seiten des Lieds samt Umrechnung (#614).
   */
  anmerkungFuer: (page: number) => Anmerkungsquelle;
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
  /**
   * Malen (#608): Ist es gesetzt, liegt über der Seite in der Bildmitte (`seite`) die Mal-Ebene. Ein
   * Finger malt, zwei Finger scrollen; ein Tipp schaltet dann keine Leisten.
   */
  malen?: {
    drawTool: DrawTool;
    setDrawTool: (t: DrawTool) => void;
    drawColor: string;
    setDrawColor: (c: string) => void;
    drawColors: string[];
  };
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
  anmerkungFuer,
  seite,
  onSeite,
  positionRef,
  onTipp,
  syncTick = 0,
  schrittRef,
  malen,
}: ScrollDeckProps) {
  const huelleRef = useRef<HTMLDivElement | null>(null);
  const [leiste, setLeiste] = useState<HTMLDivElement | null>(null);
  // Nach dem Zurückschreiben auf die A4-Seiten neu lesen (Stift aus → die Anzeige zeigt das Gemalte).
  const [gespeichert, setGespeichert] = useState(0);
  // Auf welcher Seite gemalt wird: beim Einschalten des Stifts die in der Bildmitte; ein Tipp auf eine
  // andere Seite macht sie zur Mal-Seite (wie beim Blättern im Querformat, #53) – ohne Strich.
  const [malSeite, setMalSeite] = useState(seite);
  const malenAn = !!malen;
  const [warAn, setWarAn] = useState(malenAn);
  if (malenAn !== warAn) {
    setWarAn(malenAn);
    if (malenAn) setMalSeite(seite);
  }
  // Zwei Finger scrollen, während der Stift an ist – die Mal-Leinwand lässt den Browser nicht scrollen.
  const zweiFinger = useRef<number | null>(null);
  const mitteY = (t: React.TouchList) => (t[0].clientY + t[1].clientY) / 2;
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

  /**
   * Die Halte-Stellen des Pedals (#609) als Scroll-Positionen: je Liedrolle Titel, Teil-Anfänge und `----`
   * (`pedalHalte`, in mm, samt Luft darüber). Die Rolle ist so breit wie A4 – daraus der Maßstab.
   * Hochgeladene PDFs haben keine; dort bleibt es beim ⅔-Schritt.
   */
  function haltePunkte(): number[] {
    const out: number[] = [];
    pages.forEach((_, p) => {
      const abb = anmerkungFuer(p).abbildung;
      const box = seitenRefs.current[p];
      if (!abb || !box) return;
      const pxProMm = box.offsetWidth / PAGE_W;
      for (const mm of pedalHalte(abb)) out.push(Math.round(box.offsetTop + mm * pxProMm));
    });
    return out.sort((a, b) => a - b);
  }
  const halteRef = useLatestRef(haltePunkte);

  // Pedal: Teil für Teil (#609) – zur nächsten Halte-Stelle, wenn sie schon zu sehen ist, sonst ⅔ weiter
  // (`pedalZiel`). Vorwärts zeigt eine Linie kurz die alte Unterkante.
  useEffect(() => {
    schrittRef.current = (richtung) => {
      const el = rootRef.current;
      if (!el) return;
      const h = el.clientHeight;
      const halte = halteRef.current();
      // Für den Browser-Test lesbar: wo das Pedal anhält (#609).
      el.dataset.halte = halte.join(',');
      const amEnde = el.scrollTop + h >= el.scrollHeight - 2;
      if (richtung === 1 && !amEnde)
        setMerker((m) => ({ top: el.scrollTop + h, n: (m?.n ?? 0) + 1 }));
      const ruhig = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      el.scrollTo({
        top: pedalZiel(el.scrollTop, h, halte, richtung),
        behavior: ruhig ? 'auto' : 'smooth',
      });
    };
    return () => {
      schrittRef.current = null;
    };
  }, [schrittRef, halteRef]);

  return (
    <div ref={huelleRef} className={styles.huelle}>
      <div
        ref={rootRef}
        className={styles.root}
        data-testid="scroll-deck"
        data-eigener-scroll=""
        onClick={() => {
          if (!malen) onTipp?.();
        }}
        onTouchStart={(e) => {
          zweiFinger.current = malen && e.touches.length === 2 ? mitteY(e.touches) : null;
        }}
        onTouchMove={(e) => {
          if (!malen || e.touches.length !== 2 || zweiFinger.current === null) return;
          const jetzt = mitteY(e.touches);
          if (rootRef.current) rootRef.current.scrollTop -= jetzt - zweiFinger.current;
          zweiFinger.current = jetzt;
        }}
        onTouchEnd={(e) => {
          if (e.touches.length < 2) zweiFinger.current = null;
        }}
      >
        {loading && (
          <div className={deck.center}>
            <Spinner />
            <span>{loadingLabel}</span>
          </div>
        )}
        {error && (
          <div className={deck.center}>
            <Icon name="warnung" size={18} /> {error}
          </div>
        )}
        {!loading && (
          <div className={styles.inhalt}>
            {pages.map((src, p) => (
              <ScrollSeite
                key={p}
                src={src}
                root={rootRef}
                quelle={anmerkungFuer(p)}
                syncTick={syncTick + gespeichert}
                gedimmt={!!malen && p !== malSeite}
                onAktivieren={malen && p !== malSeite ? () => setMalSeite(p) : undefined}
                malen={
                  malen && p === malSeite
                    ? {
                        ...malen,
                        rootRef: huelleRef,
                        leisteZiel: leiste,
                        onGespeichert: () => setGespeichert((n) => n + 1),
                      }
                    : undefined
                }
                seitenRef={(n) => {
                  seitenRefs.current[p] = n;
                }}
              />
            ))}
            {merker && (
              <div
                key={merker.n}
                className={styles.merker}
                style={{ top: merker.top }}
                aria-hidden
              />
            )}
          </div>
        )}
      </div>
      {/* Werkzeugleiste beim Malen – außerhalb der Scroll-Fläche, damit sie stehen bleibt. */}
      <div ref={setLeiste} className={styles.leiste} />
    </div>
  );
}

interface ScrollSeiteProps {
  src: HTMLCanvasElement;
  root: MutableRefObject<HTMLDivElement | null>;
  quelle: Anmerkungsquelle;
  syncTick: number;
  /** Beim Malen: nicht die Mal-Seite – abgeblendet, ein Tipp macht sie zur Mal-Seite. */
  gedimmt?: boolean;
  onAktivieren?: () => void;
  /** Nur auf der Mal-Seite, solange der Stift an ist (#608). */
  malen?: NonNullable<ScrollDeckProps['malen']> & {
    rootRef: MutableRefObject<HTMLDivElement | null>;
    leisteZiel: HTMLElement | null;
    onGespeichert: () => void;
  };
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
 * Bis wohin (mm, A4) im Bereich `q` einer Seite Striche stehen – `null`, wenn er leer ist. Für das Wachsen der
 * Rolle unter dem letzten Teil (#626, `rollenUnterkante`).
 */
function belegtBis(bild: HTMLImageElement, q: Rechteck): number | null {
  const m = bild.width / PAGE_W; // Bildpunkte je mm im Bild
  const x = Math.max(0, Math.floor(q.x * m));
  const y = Math.max(0, Math.floor(q.y * m));
  const w = Math.min(bild.width - x, Math.ceil(q.w * m));
  const h = Math.min(bild.height - y, Math.ceil(q.h * m));
  if (w <= 0 || h <= 0) return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bild, x, y, w, h, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  for (let zeile = h - 1; zeile >= 0; zeile--)
    for (let i = zeile * w * 4 + 3; i < (zeile + 1) * w * 4; i += 4)
      if (d[i] > 0) return (y + zeile + 1) / m;
  return null;
}

/**
 * Eine Seite im Scroll-Modus: Seite, fremde Striche, eigene Striche (in DIESER Reihenfolge wie beim
 * Blättern, `composePane`) und darüber die Texte – mit demselben Stil wie in der Live-Ansicht
 * (`textObjStyle`, #113). Bei der Rolle kommen Striche und Texte von den A4-Seiten des Lieds, Streifen für
 * Streifen umgerechnet (#614).
 */
function ScrollSeite({
  src,
  root,
  quelle,
  syncTick,
  seitenRef,
  malen,
  gedimmt = false,
  onAktivieren,
}: ScrollSeiteProps) {
  // Die Schlüssel sind die Abhängigkeit – nicht das je Render neu gebaute Objekt (vgl. `utils/pageKeys`).
  const schluessel = quelle.seiten.map((x) => `${x.own ?? ''}|${x.over ?? ''}`).join('\u0001');
  const abbildung = quelle.abbildung;
  const liste = useMemo(() => (abbildung ? streifen(abbildung) : null), [abbildung]);
  const seiten = useMemo(
    () =>
      schluessel.split('\u0001').map((x) => {
        const [own, over] = x.split('|');
        return { own: own || null, over: over || null };
      }),
    [schluessel],
  );
  /** Höhe des gesetzten Lieds in mm (die Rolle ist so breit wie A4). */
  const basisMm = (PAGE_W * src.height) / src.width;
  // Steht unter dem letzten Teil etwas (auf A4 ist dort oft Platz), wächst die Rolle bis dahin (#626).
  // `null` = noch nicht ausgemessen – solange gibt es keine Mal-Ebene (sie rechnet in Anteilen der Höhe).
  const [zusatzMm, setZusatzMm] = useState<number | null>(null);
  // Beim Malen liegen die eigenen Anmerkungen der Kerne in der Mal-Ebene (dort bearbeitbar) – hier
  // also nur noch das, was dort nicht steht: fremde Ebene und eigene Lücken. Ohne Abbildung (hochgeladenes
  // PDF) liegt die ganze eigene Ebene in der Mal-Ebene. Bearbeitet wird erst, wenn die Mal-Ebene da ist
  // (nach dem Ausmessen, #626) – bis dahin zeigt diese Seite alles selbst, sonst wären die eigenen Texte
  // der Teile einen Moment lang verschwunden.
  const bearbeiten = !!malen && zusatzMm !== null;
  /** Höhe dieser Seite in mm – samt dem Platz für Anmerkungen unter dem Lied. */
  const hoeheMm = basisMm + (zusatzMm ?? 0);
  const hoehePx = Math.round((hoeheMm * src.width) / PAGE_W);
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
    if (!liste) {
      setZusatzMm(0);
      return;
    }
    let aktuell = true;
    void Promise.all(seiten.map((x) => Promise.all([ladeBild(x.over), ladeBild(x.own)]))).then(
      (bilder) => {
        if (!aktuell) return;
        let unten = 0;
        bilder.forEach((paar, seite) => {
          const striche = paar.filter((b): b is HTMLImageElement => !!b);
          const texte = [
            ...readPageTexts<PageTextObj>(seiten[seite].over),
            ...readPageTexts<PageTextObj>(seiten[seite].own),
          ];
          const bis = (q: Rechteck) =>
            striche.reduce<number | null>((m, b) => {
              const v = belegtBis(b, q);
              return v === null ? m : Math.max(m ?? 0, v);
            }, null);
          unten = Math.max(
            unten,
            rollenUnterkante(liste, seite, basisMm - ROLLEN_RAND_UNTEN, bis, texte),
          );
        });
        const neu = Math.max(0, Math.ceil(unten + ROLLEN_RAND_UNTEN - basisMm));
        // Beim Malen bleibt die Höhe, wie sie ist: Die Mal-Ebene rechnet in Anteilen der Höhe, ihr Entwurf und
        // noch nicht gespeicherte Striche passten sonst nicht mehr. Nach dem Malen wird neu ausgemessen.
        setZusatzMm((alt) => (bearbeiten && alt !== null ? alt : neu));
      },
    );
    return () => {
      aktuell = false;
    };
  }, [liste, seiten, basisMm, syncTick, bearbeiten]);

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
    void Promise.all(seiten.map((x) => Promise.all([ladeBild(x.over), ladeBild(x.own)]))).then(
      (bilder) => {
        if (!aktuell) return;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        c.width = src.width;
        c.height = hoehePx;
        ctx.drawImage(src, 0, 0);
        // Erst alle fremden, dann alle eigenen Striche – die eigenen liegen obenauf (wie beim Blättern).
        for (const ebene of [0, 1] as const) {
          bilder.forEach((paar, seite) => {
            const bild = paar[ebene];
            if (!bild) return;
            const eigen = ebene === 1;
            // Beim Malen stehen die eigenen Kerne in der Mal-Ebene – hier nur noch die Lücken.
            if (liste)
              stricheAufRolle(
                ctx,
                bild,
                liste,
                seite,
                c.width,
                eigen && bearbeiten ? 'luecke' : undefined,
              );
            else if (!(eigen && bearbeiten)) ctx.drawImage(bild, 0, 0);
          });
        }
      },
    );
    return () => {
      aktuell = false;
    };
  }, [nah, src, hoehePx, seiten, liste, syncTick, bearbeiten]);

  const texte = useMemo(
    () =>
      seiten.flatMap((x, seite) => {
        const fremd = readPageTexts<PageTextObj>(x.over);
        const eigen = readPageTexts<PageTextObj>(x.own);
        if (!liste) return bearbeiten ? fremd : [...fremd, ...eigen];
        return [
          ...fremd.map((t) => ({ t, eigen: false })),
          ...eigen.map((t) => ({ t, eigen: true })),
        ].flatMap(({ t, eigen: istEigen }) => {
          const z = textAufRolle(t, liste, seite, hoeheMm);
          // Beim Malen stehen eigene Texte der Kerne in der Mal-Ebene (dort bearbeitbar).
          if (!z || (istEigen && bearbeiten && z.art === 'kern')) return [];
          return [{ ...z, id: seite * 1_000_000 + t.id }];
        });
      }),
    // syncTick ist das Signal, dass sich der Speicher geändert hat (wie in PageDeck).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seiten, liste, hoeheMm, syncTick, bearbeiten],
  );

  const seitenformat = `${src.width} / ${hoehePx}`;
  return (
    <div
      ref={(n) => {
        boxRef.current = n;
        seitenRef(n);
      }}
      className={`${styles.seite}${gedimmt ? ' ' + styles.gedimmt : ''}`}
      style={{ aspectRatio: seitenformat }}
      onPointerDown={
        onAktivieren
          ? (e) => {
              e.stopPropagation();
              onAktivieren();
            }
          : undefined
      }
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
      {malen && bearbeiten && (
        <RollenMalen
          quelle={quelle}
          breitePx={src.width}
          hoehePx={hoehePx}
          hoeheMm={hoeheMm}
          rootRef={malen.rootRef}
          leisteZiel={malen.leisteZiel}
          drawTool={malen.drawTool}
          setDrawTool={malen.setDrawTool}
          drawColor={malen.drawColor}
          setDrawColor={malen.setDrawColor}
          drawColors={malen.drawColors}
          onGespeichert={malen.onGespeichert}
        />
      )}
    </div>
  );
}
