import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Icon } from '@ui/icons/icons';
import { useAufklapp } from '@ui/bedienung/useAufklapp';
import { useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { listenScroll, menueVersatz } from '@ui/bedienung/menueLage';
import type { Knoten } from '@shared/organigramm/gruppen';
import { spitzenSuche, spitzenWahl } from '@shared/organigramm/ansichten';
import styles from './SpitzenAuswahl.module.scss';

/** So weit rückt jede Ebene ein (px). */
const EINZUG = 14;
/**
 * **„Anfangen bei“ – jede Gruppe, mit Suche** (#915, Rückmeldung 11.11.2026: „nur das Kaffeeteam und die Untergruppen
 * darin“). Ein Knopf im Stil der Felder; er klappt ein Menü auf: oben ein Suchfeld, darunter die Gemeinde und alle
 * Gruppen, nach Ebene eingerückt. Beim Suchen stehen die Treffer ohne Einzug, mit ihren Obergruppen darunter, damit
 * gleichnamige Gruppen auseinanderzuhalten sind. Eine Stelle für den Reiter („Anfangen bei“) und die PDF
 * („Ausschnitt“) – vorher zwei gleiche `<select>`.
 *
 * Mit der Maus springt der Fokus gleich ins Suchfeld (tippen, Pfeiltasten, Enter). Am Handy nicht: Dort ginge sonst
 * bei jedem Öffnen die Tastatur auf und verdeckte die halbe Liste.
 */
export function SpitzenAuswahl({
  label,
  baum,
  wert,
  onWahl,
  feldKlasse,
}: {
  /** Steht vor dem Knopf und nennt ihn für Bildschirmleser („Anfangen bei“, „Ausschnitt“). */
  label: string;
  baum: readonly Knoten[];
  /** Der gewählte Pfad – `null` = ganze Gemeinde. */
  wert: string | null;
  onWahl: (wert: string | null) => void;
  /** Das Aussehen des Felds kommt von der Stelle (Leiste im Reiter bzw. Fenster). */
  feldKlasse: string;
}) {
  const { offen, setOffen, rahmen } = useAufklapp();
  const maus = useMedienAbfrage('(hover: hover) and (pointer: fine)');
  const [suche, setSuche] = useState('');
  const [aktiv, setAktiv] = useState(0);
  const id = useId();
  const wahl = useMemo(() => spitzenWahl(baum, wert), [baum, wert]);
  const liste = useMemo(() => spitzenSuche(wahl, suche), [wahl, suche]);
  const gewaehlt = wahl.find((w) => w.wert === (wert ?? '')) ?? wahl[0];
  const sucht = suche.trim() !== '';

  const menue = useRef<HTMLDivElement>(null);
  const listeRef = useRef<HTMLUListElement>(null);
  const suchFeld = useRef<HTMLInputElement>(null);

  // Vor dem ersten Bild: rechts im Bildschirm halten (`menueVersatz`) – und ERST DANN mit der Maus ins Suchfeld, ohne
  // Scrollen. Mit `autoFocus` kam der Fokus vor dieser Rechnung, solange das Menü noch überstand: Der Browser scrollte
  // den Behälter von ChurchTools 16 px zur Seite, die Messung war verschoben, und das Menü stand rechts am Rand
  // (Test-Instanz 11.11.2026, 375 px breit, mit Maus).
  useLayoutEffect(() => {
    const m = menue.current;
    if (!offen || !m) return;
    m.style.left = '0px';
    const r = m.getBoundingClientRect();
    m.style.left = `${menueVersatz(r.left, r.width, document.documentElement.clientWidth)}px`;
    if (maus) suchFeld.current?.focus({ preventScroll: true });
  }, [offen, maus]);

  // Die markierte Zeile bleibt im Blick (lange Liste, Pfeiltasten) – nur die Liste scrollt, nie die Seite.
  useEffect(() => {
    const ul = listeRef.current;
    const li = document.getElementById(`${id}-${aktiv}`);
    if (!offen || !ul || !li) return;
    ul.scrollTop = listenScroll(ul.scrollTop, ul.clientHeight, li.offsetTop, li.offsetHeight);
  }, [offen, aktiv, id]);

  const umschalten = () => {
    if (!offen) {
      setSuche('');
      setAktiv(Math.max(0, wahl.indexOf(gewaehlt)));
    }
    setOffen(!offen);
  };
  const waehlen = (w: string) => {
    setOffen(false);
    onWahl(w || null);
  };
  const taste = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const schritt = e.key === 'ArrowDown' ? 1 : -1;
      setAktiv((a) => Math.min(liste.length - 1, Math.max(0, a + schritt)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const w = liste[aktiv];
      if (w) waehlen(w.wert);
    }
  };

  return (
    <span className={styles.rahmen} ref={rahmen}>
      <button
        type="button"
        className={`${feldKlasse} ${styles.knopf}`}
        aria-haspopup="listbox"
        aria-expanded={offen}
        aria-label={`${label}: ${gewaehlt.name}`}
        data-wert={gewaehlt.wert}
        onClick={umschalten}
      >
        <span className={styles.name}>{gewaehlt.name}</span>
        <Icon name="chev-down" size={14} />
      </button>
      {offen && (
        <div className={styles.menue} ref={menue}>
          <label className={styles.suche}>
            <Icon name="search" size={14} />
            <input
              type="search"
              role="combobox"
              aria-label="Gruppe suchen"
              aria-controls={id}
              aria-expanded
              aria-activedescendant={liste[aktiv] ? `${id}-${aktiv}` : undefined}
              placeholder="Gruppe suchen"
              ref={suchFeld}
              value={suche}
              onChange={(e) => {
                setSuche(e.target.value);
                setAktiv(0);
              }}
              onKeyDown={taste}
            />
          </label>
          <ul ref={listeRef} className={styles.liste} role="listbox" id={id} aria-label={label}>
            {liste.map((w, i) => (
              <li
                key={w.wert}
                id={`${id}-${i}`}
                role="option"
                aria-selected={w.wert === gewaehlt.wert}
                className={`${styles.option}${i === aktiv ? ` ${styles.aktiv}` : ''}${
                  w.wert === gewaehlt.wert ? ` ${styles.gewaehlt}` : ''
                }`}
                style={{ paddingLeft: 10 + (sucht ? 0 : w.ebene) * EINZUG }}
                onPointerEnter={() => setAktiv(i)}
                onClick={() => waehlen(w.wert)}
              >
                <span className={w.ebene <= 1 ? styles.fett : undefined}>{w.name}</span>
                {sucht && w.weg && <span className={styles.weg}>{w.weg}</span>}
              </li>
            ))}
          </ul>
          {liste.length === 0 && <p className={styles.leer}>Keine Gruppe gefunden</p>}
        </div>
      )}
    </span>
  );
}
