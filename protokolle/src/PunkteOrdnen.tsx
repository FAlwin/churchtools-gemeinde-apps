import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as TastenEreignis,
} from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { BodyPortal } from '@ui/fenster/BodyPortal';
import { Icon } from '@ui/icons/icons';
import type { Block } from '@shared/protokolle/dokument';
import {
  geschwisterVon,
  gliederung,
  punktVerschieben,
  type GliederungsPunkt,
} from '@shared/protokolle/gliederung';
import { usePunkteZiehen } from './usePunkteZiehen';
import styles from './PunkteOrdnen.module.scss';

/**
 * **Fenster „Punkte ordnen“** (Bauplan W7, Entwurf `punkte-ordnen-v1`, Variante A – Alwin 18.11.2026). Im Text lassen sich
 * Tagesordnungspunkte nicht mehr ziehen (das war „hakelig, unklar, was passiert“); hier stellt man sie um:
 *
 * - **Liste** aller Punkte (Tagesordnungspunkt) und Unterpunkte (eingerückt) mit der Nummer wie im Text, dem Titel und
 *   einer Zeile, **was mitwandert** („3 Stichpunkte · 1 To-Do“). Ein Punkt nimmt Unterpunkte und Inhalt mit; die Ebene
 *   bleibt (Regel `@shared/protokolle/gliederung`).
 * - **Bedienung:** ziehen am Griff (Maus sofort, Finger nach kurzem Halten – `usePunkteZiehen`, mit Einfügelinie nur an
 *   erlaubten Stellen), ↑/↓ je Zeile, auf dem Griff die Pfeiltasten. Ein Knopf, der nicht weiter kann, ist ausgegraut.
 * - **„Rückgängig“ im Fenster** (Regel „Rückgängig im Modal“, 19.10.2026) – der letzte Schritt im Fenster, mit dem Satz, was
 *   zuletzt passiert ist.
 * - **Übernehmen** ist erst nach einer Änderung bedienbar und ändert erst dann das Dokument (`onUebernehmen`, ein Schritt
 *   im Editor). **Abbrechen** ändert nichts. Mit ungespeicherter Änderung schließt weder ein Tipp daneben noch das X noch
 *   Esc das Fenster – es sagt, dass erst „Übernehmen“ oder „Abbrechen“ zu wählen ist (Entwurf). Esc und der Tipp
 *   daneben laufen über `onHintergrund` des `Sheet` (Esc = Klick daneben, #1011); beim Ziehen bricht Esc nur den Zug ab.
 * - Am Handy bildschirmfüllend (`Sheet handyVoll`), größere Griffe und Pfeilknöpfe.
 *
 * Gearbeitet wird auf einer Kopie der obersten Blöcke; das Dokument bleibt bis „Übernehmen“ unberührt.
 */

/** Ein Schritt im Fenster – der Stand davor, damit „Rückgängig“ ihn zurückholt. */
interface Schritt {
  bloecke: readonly Block[];
  hinweis: string;
}

interface Stand {
  bloecke: readonly Block[];
  verlauf: readonly Schritt[];
  /** Der Satz zum letzten Schritt (oder zum Rückgängig). */
  hinweis: string;
}

const TITEL_LEER = 'Ohne Titel';

export function PunkteOrdnen({
  dokument,
  onUebernehmen,
  onClose,
}: {
  /** Die obersten Blöcke des Protokolls, wie sie beim Öffnen waren. */
  dokument: readonly Block[];
  /** Die neue Reihenfolge (Block-IDs der obersten Ebene) in den Editor bringen; `false`, wenn das nicht ging. */
  onUebernehmen: (reihenfolge: string[]) => boolean;
  onClose: () => void;
}) {
  const [stand, setStand] = useState<Stand>({ bloecke: dokument, verlauf: [], hinweis: '' });
  const [fehler, setFehler] = useState<string | null>(null);
  const [warnung, setWarnung] = useState(false);
  const liste = useRef<HTMLUListElement>(null);
  /** Wohin der Fokus nach dem nächsten Zeichnen soll (die Zeile steht nach dem Umstellen woanders im Dokument). */
  const fokus = useRef<{ id: string; art: 'griff' | 'hoch' | 'runter' } | null>(null);

  const baum = useMemo(() => gliederung(stand.bloecke), [stand.bloecke]);
  const geaendert = stand.bloecke.some((b, i) => b.id !== dokument[i]?.id);
  // Geht der Punkt hoch/runter? Aus derselben Regel wie das Ziehen – nicht aus „ist er der Erste“ geraten.
  const beweglich = useMemo(() => {
    const m = new Map<string, { hoch: boolean; runter: boolean }>();
    const lauf = (l: readonly GliederungsPunkt[]): void => {
      l.forEach((k, i) => {
        m.set(k.id, {
          hoch: i > 0 && punktVerschieben(stand.bloecke, k.id, i - 1) !== null,
          runter: i < l.length - 1 && punktVerschieben(stand.bloecke, k.id, i + 1) !== null,
        });
        lauf(k.kinder);
      });
    };
    lauf(baum);
    return m;
  }, [baum, stand.bloecke]);

  const verschieben = (id: string, platz: number, art: 'griff' | 'hoch' | 'runter'): void => {
    const r = punktVerschieben(stand.bloecke, id, platz);
    if (!r) return;
    fokus.current = { id, art };
    setWarnung(false);
    setStand({
      bloecke: r.bloecke,
      verlauf: [...stand.verlauf, { bloecke: stand.bloecke, hinweis: r.hinweis }],
      hinweis: r.hinweis,
    });
  };
  const einenSchritt = (id: string, richtung: -1 | 1, art: 'griff' | 'hoch' | 'runter'): void => {
    const g = geschwisterVon(baum, id);
    if (g) verschieben(id, g.index + richtung, art);
  };
  const rueckgaengig = (): void => {
    const letzter = stand.verlauf[stand.verlauf.length - 1];
    if (!letzter) return;
    setWarnung(false);
    setStand({
      bloecke: letzter.bloecke,
      verlauf: stand.verlauf.slice(0, -1),
      hinweis: `Rückgängig: ${letzter.hinweis}`,
    });
  };

  // Nach dem Umstellen den Fokus an die Zeile zurückgeben – der Knopf wurde im Dokument verschoben (und verliert dabei
  // in manchen Browsern den Fokus); ein ausgegrauter Pfeil nimmt den Griff.
  useLayoutEffect(() => {
    const f = fokus.current;
    fokus.current = null;
    if (!f || !liste.current) return;
    const zeile = [...liste.current.querySelectorAll<HTMLElement>('li[data-punkt]')].find(
      (l) => l.dataset.punkt === f.id,
    );
    const kopf = zeile?.firstElementChild;
    const knopf =
      f.art === 'griff'
        ? null
        : kopf?.querySelector<HTMLButtonElement>(`[data-richtung="${f.art}"]`);
    (knopf && !knopf.disabled ? knopf : kopf?.querySelector<HTMLElement>('[data-griff]'))?.focus({
      preventScroll: true,
    });
  }, [stand]);

  const { zieht, beiGriffDruck } = usePunkteZiehen({
    liste,
    gueltig: (id, platz) =>
      punktVerschieben(stand.bloecke, id, platz) !== null ||
      geschwisterVon(baum, id)?.index === platz,
    onAblegen: (id, platz) => verschieben(id, platz, 'griff'),
  });

  const versuchZu = (): void => {
    if (geaendert) setWarnung(true);
    else onClose();
  };

  const uebernehmen = (): void => {
    if (onUebernehmen(stand.bloecke.map((b) => b.id))) onClose();
    else
      setFehler(
        'Das Protokoll hat sich inzwischen verändert. Bitte „Abbrechen“ wählen und „Punkte ordnen“ noch einmal öffnen.',
      );
  };

  const taste = (e: TastenEreignis<HTMLElement>, id: string): void => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    einenSchritt(id, e.key === 'ArrowUp' ? -1 : 1, 'griff');
  };

  const zeile = (k: GliederungsPunkt, eltern: string) => {
    const titel = k.titel.trim() || TITEL_LEER;
    const b = beweglich.get(k.id);
    const abgeblendet = zieht !== null && zieht.eltern !== eltern;
    return (
      <li
        key={k.id}
        className={`${styles.punkt}${zieht?.id === k.id ? ` ${styles.zieht}` : ''}`}
        data-punkt={k.id}
        data-eltern={eltern}
      >
        <div className={`${styles.zeile}${abgeblendet ? ` ${styles.abgeblendet}` : ''}`}>
          <button
            type="button"
            className={styles.griff}
            data-griff
            aria-label={`${titel} verschieben – ziehen oder Pfeiltaste hoch oder runter`}
            title="Ziehen oder Pfeiltasten"
            onPointerDown={(e) => beiGriffDruck(e, k.id)}
            onKeyDown={(e) => taste(e, k.id)}
            onContextMenu={(e) => e.preventDefault()}
          >
            <Icon name="grip" size={18} />
          </button>
          <ZeilenText k={k} titel={titel} />
          <button
            type="button"
            className={styles.pfeil}
            data-richtung="hoch"
            aria-label={`${titel} nach oben`}
            disabled={!b?.hoch}
            onClick={() => einenSchritt(k.id, -1, 'hoch')}
          >
            <Icon name="chev-up" size={18} />
          </button>
          <button
            type="button"
            className={styles.pfeil}
            data-richtung="runter"
            aria-label={`${titel} nach unten`}
            disabled={!b?.runter}
            onClick={() => einenSchritt(k.id, 1, 'runter')}
          >
            <Icon name="chev-down" size={18} />
          </button>
        </div>
        {k.kinder.length > 0 && (
          <ul className={styles.kinder} role="list">
            {k.kinder.map((x) => zeile(x, k.id))}
          </ul>
        )}
      </li>
    );
  };

  const gezogen = zieht
    ? geschwisterVon(baum, zieht.id)?.liste.find((k) => k.id === zieht.id)
    : null;

  return (
    <Sheet
      title="Punkte ordnen"
      mittel
      handyVoll
      onClose={versuchZu}
      onHintergrund={versuchZu}
      onAbbrechen={onClose}
      knoepfe={
        <FensterKnopf disabled={!geaendert} onClick={uebernehmen}>
          Übernehmen
        </FensterKnopf>
      }
    >
      <p className={styles.info}>
        Ein Punkt nimmt seine Unterpunkte und seinen Inhalt mit. Unterpunkte bleiben in ihrem Punkt.
        Die Nummern passen sich an.
      </p>
      <div className={styles.leiste}>
        <span className={styles.satz} role="status" aria-live="polite">
          {stand.hinweis || 'Noch nichts verschoben.'}
        </span>
        <button
          type="button"
          className={styles.rueckgaengig}
          disabled={stand.verlauf.length === 0}
          onClick={rueckgaengig}
        >
          <Icon name="undo" size={16} />
          Rückgängig
        </button>
      </div>
      {warnung && (
        <p className={styles.warnung} role="alert">
          Erst „Übernehmen“ oder „Abbrechen“ wählen.
        </p>
      )}
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}
      <ul ref={liste} className={styles.liste} role="list" aria-label="Tagesordnung">
        {baum.map((k) => zeile(k, ''))}
        {zieht?.linie && (
          <li
            aria-hidden
            className={styles.linie}
            style={{ top: zieht.linie.top, left: zieht.linie.left, width: zieht.linie.breite }}
          />
        )}
      </ul>
      <p className={styles.hilfe}>
        {zieht
          ? 'Ablegen an der blauen Linie – Unterpunkte und Inhalt wandern mit. Esc bricht ab.'
          : 'Ziehen am Griff, ↑ ↓ drücken oder Pfeiltasten auf dem Griff.'}
      </p>
      {zieht && gezogen && (
        <BodyPortal>
          <div
            className={styles.bild}
            aria-hidden
            style={{ top: zieht.bild.top, left: zieht.bild.left, width: zieht.bild.breite }}
          >
            <ZeilenText k={gezogen} titel={gezogen.titel.trim() || TITEL_LEER} />
          </div>
        </BodyPortal>
      )}
    </Sheet>
  );
}

/** Nummer, Titel und „was mitwandert“ – in der Liste und im Bild unter dem Zeiger. */
function ZeilenText({ k, titel }: { k: GliederungsPunkt; titel: string }) {
  return (
    <>
      <span className={styles.nummer}>{k.nummer}</span>
      <span className={styles.text}>
        <b>{titel}</b>
        <small>{k.mit}</small>
      </span>
    </>
  );
}
