import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { akkordTeile, tonartAkkorde } from '../utils/transpose';
import { akkordeImText } from '../utils/chordpro';
import styles from './AkkordLeiste.module.scss';

interface Props {
  /** Die Tonart, in der der Text steht – ihre Akkorde liegen vorne in der Leiste. */
  tonart?: string;
  /** Der ChordPro-Text, wie er gerade im Editor steht (für „Im Lied“). */
  text: string;
  /** In dieser Sitzung zuletzt gesetzt, neuester zuerst. */
  zuletzt: string[];
  /** Akkord an der Cursorstelle einfügen. */
  waehlen: (akkord: string) => void;
  /** Das Fenster „Anderer Akkord“ öffnen. */
  anderer: () => void;
  /**
   * Schreibansicht (Tastatur offen): eine Zeile ohne Umbruch, „Im Lied“ als Ausklappmenü (Alwin, 23.10.2026: „mir
   * fehlen die Akkorde im Lied. Vielleicht als Dropdown?“).
   */
  kompakt?: boolean;
}

/** Varianten desselben Grundtons beim Gedrückthalten (Alwin: „was wenn ich Em7 brauche? Oder Gsus4?“). */
const VARIANTEN = ['', 'm', '7', 'm7', 'maj7', 'sus4', 'sus2', 'add9', 'm9', '7sus4'];
const LANG_MS = 450;
const IM_LIED_MAX = 6;

/**
 * **Akkorde einfügen ohne Menü** (Lied-Editor L5, Entwurf Variante A, 22.10.2026; Alwin: „Akkorde einfügen ist noch
 * nicht so intuitiv“). Cursor in den Text, dann einen Akkord antippen:
 * - **Tonart E:** die Akkorde der Tonart (`tonartAkkorde`) – damit kommen die meisten Lieder aus.
 * - **Im Lied:** was sonst schon im Lied steht oder gerade gesetzt wurde (`akkordeImText`).
 * - **Gedrückt halten:** Varianten desselben Grundtons (Em7, Esus4 …).
 * - **Anderer Akkord:** Fenster zum Eintippen oder Zusammenstellen.
 */
export function AkkordLeiste({ tonart, text, zuletzt, waehlen, anderer, kompakt = false }: Props) {
  const eigene = useMemo(() => (tonart ? tonartAkkorde(tonart) : []), [tonart]);
  const imLied = useMemo(() => {
    const liste = [...zuletzt, ...akkordeImText(text)].filter((a) => !eigene.includes(a));
    return [...new Set(liste)].slice(0, IM_LIED_MAX);
  }, [text, zuletzt, eigene]);

  // EIN Aufklappfenster für die Varianten (Gedrückthalten) und „Im Lied“ in der Schreibansicht.
  const [liste, setListe] = useState<{
    titel: string;
    akkorde: string[];
    x: number;
    y: number;
  } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  // Nach dem Gedrückthalten kommt noch ein Klick – der darf nicht auch noch einfügen.
  const lang = useRef(false);
  const popRef = useRef<HTMLDivElement>(null);

  const imLiedKnopf = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!liste) return;
    const zu = (e: PointerEvent) => {
      const ziel = e.target as Node;
      // Der Knopf „Im Lied“ schaltet selbst um – sonst ginge das Fenster hier zu und beim Klick wieder auf.
      if (!popRef.current?.contains(ziel) && !imLiedKnopf.current?.contains(ziel)) setListe(null);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setListe(null);
    document.addEventListener('pointerdown', zu);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', zu);
      document.removeEventListener('keydown', esc);
    };
  }, [liste]);

  function chip(akkord: string) {
    const halten = (e: React.PointerEvent<HTMLButtonElement>) => {
      lang.current = false;
      const r = e.currentTarget.getBoundingClientRect();
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const grund = akkordTeile(akkord)?.grund;
        if (!grund) return;
        lang.current = true;
        setListe({
          titel: `Varianten von ${grund}`,
          akkorde: VARIANTEN.map((art) => grund + art),
          x: r.left,
          y: r.bottom + 6,
        });
      }, LANG_MS);
    };
    const loslassen = () => window.clearTimeout(timer.current);
    return (
      <button
        key={akkord}
        type="button"
        className={styles.chip}
        // Der Cursor im Text bleibt, wo er ist (sonst nimmt der Knopf ihm den Fokus).
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={halten}
        onPointerUp={loslassen}
        onPointerLeave={loslassen}
        onPointerCancel={loslassen}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (lang.current) {
            lang.current = false;
            return;
          }
          waehlen(akkord);
        }}
      >
        {akkord}
      </button>
    );
  }

  return (
    <div
      className={`${styles.leiste}${kompakt ? ' ' + styles.kompakt : ''}`}
      role="group"
      aria-label="Akkorde"
    >
      {eigene.length > 0 && (
        <div className={styles.gruppe}>
          {/* In der Schreibansicht ohne Beschriftung – sonst passt die eine Zeile am iPad nicht. */}
          {!kompakt && <span className={styles.lbl}>Tonart {tonart}</span>}
          {eigene.map(chip)}
        </div>
      )}
      {imLied.length > 0 && !kompakt && (
        <div className={styles.gruppe}>
          <span className={styles.lbl}>Im Lied</span>
          {imLied.map(chip)}
        </div>
      )}
      {imLied.length > 0 && kompakt && (
        <button
          ref={imLiedKnopf}
          type="button"
          className={styles.anderer}
          aria-expanded={liste?.titel === 'Im Lied'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setListe((l) =>
              l?.titel === 'Im Lied'
                ? null
                : { titel: 'Im Lied', akkorde: imLied, x: r.left, y: r.bottom + 6 },
            );
          }}
        >
          Im Lied
          <Icon name="chev-down" size={15} stroke={2.2} />
        </button>
      )}
      <button
        type="button"
        className={styles.anderer}
        aria-label="Anderer Akkord"
        title="Anderer Akkord"
        onMouseDown={(e) => e.preventDefault()}
        onClick={anderer}
      >
        <Icon name="plus" size={15} stroke={2.2} />
        {!kompakt && 'Anderer Akkord'}
      </button>

      {liste && (
        <div
          ref={popRef}
          className={styles.varianten}
          role="group"
          aria-label={liste.titel}
          style={{
            left: Math.max(16, Math.min(liste.x, window.innerWidth - 360)),
            top: liste.y,
          }}
        >
          <span className={styles.lbl}>{liste.titel}</span>
          <div className={styles.variantenReihe}>
            {liste.akkorde.map((a) => (
              <button
                key={a}
                type="button"
                className={styles.chip}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setListe(null);
                  waehlen(a);
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
