import { useState } from 'react';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Sheet } from '@ui/fenster/Sheet';
import { akkordLesen, akkordTeile } from '../utils/transpose';
import styles from './AkkordFenster.module.scss';

interface Props {
  /** Ein vorhandener Akkord, der geändert wird – sonst beginnt der Baukasten bei `grundton`. */
  start?: string;
  /** Grundton, mit dem ein neuer Akkord beginnt (die Tonart des Lieds). */
  grundton?: string;
  /** Beschriftung des Hauptknopfs („Einfügen“, beim Ändern „Übernehmen“). */
  knopf?: string;
  fertig: (akkord: string) => void;
  onClose: () => void;
}

// Grundtöne in der gebräuchlichen Schreibweise (wie der SongSelect-Editor).
const GRUNDTOENE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
// Akkord-Arten (Dur = ohne Zusatz) – Seltenes wie `7sus4` oder `m9` geht über das Eintippen.
const ARTEN = ['', 'm', '7', 'm7', 'maj7', 'sus4', 'sus2', 'add9', '6', 'dim', 'aug'];

/**
 * **„Anderer Akkord“** (Lied-Editor L5): eintippen (`em7`, `d/f#`) oder aus Grundton, Art und Bass zusammenstellen,
 * mit großer Vorschau – und dann EINMAL einfügen. Vorher hängte der Baukasten Art und Bass an den zuletzt
 * eingefügten Akkord an; das war nicht zu durchschauen (Alwin am iPad, 22.10.2026).
 */
export function AkkordFenster({
  start,
  grundton = 'C',
  knopf = 'Einfügen',
  fertig,
  onClose,
}: Props) {
  const anfang = (start && akkordTeile(start)) || { grund: grundton, art: '', bass: '' };
  const [teile, setTeile] = useState(anfang);
  const [eingabe, setEingabe] = useState('');
  const getippt = eingabe.trim() ? akkordLesen(eingabe) : null;
  const unlesbar = eingabe.trim() !== '' && !getippt;
  const akkord = teile.grund + teile.art + (teile.bass ? '/' + teile.bass : '');

  function tippen(wert: string) {
    setEingabe(wert);
    const a = wert.trim() ? akkordLesen(wert) : null;
    const t = a && akkordTeile(a);
    if (t) setTeile(t);
  }
  function setzen(neu: Partial<typeof teile>) {
    setEingabe('');
    setTeile((t) => ({ ...t, ...neu }));
  }

  function raster(
    werte: string[],
    gewaehlt: string,
    beschriftung: (w: string) => string,
    waehlen: (w: string) => void,
  ) {
    return (
      <div className={styles.raster}>
        {werte.map((w) => (
          <button
            key={w}
            type="button"
            className={`${styles.wahl}${w === gewaehlt ? ' ' + styles.an : ''}`}
            aria-pressed={w === gewaehlt}
            onClick={() => waehlen(w)}
          >
            {beschriftung(w)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <Sheet
      title={start ? 'Akkord ändern' : 'Anderer Akkord'}
      onClose={onClose}
      knoepfe={
        <FensterKnopf disabled={unlesbar} onClick={() => fertig(akkord)}>
          {knopf}
        </FensterKnopf>
      }
    >
      <label className={styles.ein}>
        <span className={styles.lbl}>Eintippen</span>
        <input
          className={`${styles.feld}${unlesbar ? ' ' + styles.falsch : ''}`}
          value={eingabe}
          onChange={(e) => tippen(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            // Sonst landet die Eingabetaste nach dem Schließen als Zeilenumbruch im Text – der Editor hat den
            // Fokus dann schon zurück (im E2E gefunden).
            e.preventDefault();
            if (!unlesbar) fertig(akkord);
          }}
          placeholder="z. B. Em7, Gsus4, D/F#"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={unlesbar}
        />
        <small className={unlesbar ? styles.fehler : styles.hinweis}>
          {unlesbar ? 'So nicht lesbar – z. B. Em7, Gsus4, D/F#' : 'oder unten zusammenstellen'}
        </small>
      </label>

      <div className={styles.vorschau} aria-live="polite">
        <span>{akkord}</span>
      </div>

      <span className={styles.lbl}>Grundton</span>
      {raster(
        GRUNDTOENE,
        teile.grund,
        (w) => w,
        (grund) => setzen({ grund }),
      )}
      <span className={styles.lbl}>Art</span>
      {raster(
        ARTEN,
        teile.art,
        (w) => w || 'Dur',
        (art) => setzen({ art }),
      )}
      <span className={styles.lbl}>Bass (Slash-Akkord)</span>
      {raster(
        ['', ...GRUNDTOENE],
        teile.bass,
        (w) => (w ? '/' + w : 'ohne'),
        (bass) => setzen({ bass }),
      )}
    </Sheet>
  );
}
