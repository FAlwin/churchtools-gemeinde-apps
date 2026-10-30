/**
 * Eine sortierbare Zeile im Bearbeiten-Modus (#198 – vorher in `pages/Setlist.tsx`; seit E6-2b-1 in `ui/ablauf`, damit
 * Musik-App und Dienstplaner dieselbe Zeile nutzen).
 *
 * Tippen auf den Titel öffnet das Aktionsmenü; gezogen wird ausschließlich am Griff – sonst würde
 * jeder Tipp auf die Zeile ein Ziehen einleiten und das Menü ließe sich kaum öffnen. Aufbau seit E6-O1 wie die
 * Ansicht (`ZeitSpalte`, `ZeilenInhalt` aus `AblaufListe`) – eine Stelle für beide.
 */
import { useEffect, useRef, useState } from 'react';
import { itemLabel, type AblaufZeile } from '@shared/ct/ablaufZeile';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '../icons/icons';
import { MenueListe, type Option } from '../bedienung/OptionWaehlen';
import { useAufklapp } from '../bedienung/useAufklapp';
import { BodyPortal } from '../fenster/BodyPortal';
import { WeggelassenHinweis } from './AblaufTeile';
import { ZeilenInhalt, ZeitSpalte } from './AblaufListe';
import styles from './AgendaSortableRow.module.scss';
import zeile from './AblaufListe.module.scss';

/** Was das Plus und der Papierkorb an einer Zeile tun (nur mit Maus, Alwin 30.10.2026). */
export interface ZeilenAktionen {
  /** „Programmpunkt dahinter einfügen“ … „Überschrift davor einfügen“ – wie das Menü in ChurchTools. */
  einfuegen: Option[];
  loeschen: () => void;
}

/**
 * **Plus und Papierkorb beim Drüberfahren** (Alwin, 30.10.2026, Entwurf `einfuegen-entwurf.html` „Am PC“): wie in
 * ChurchTools erscheinen sie neben dem Stift, sobald die Maus über der Zeile steht – das Plus klappt „… dahinter / davor
 * einfügen“ auf, der rote Papierkorb fragt wie „Eintrag löschen“ nach. Am Handy gibt es kein Drüberfahren; dort führen
 * „Einfügen nach“ und „Darunter einfügen“ im Fenster hin, die Knöpfe stehen gar nicht erst da (CSS).
 *
 * Das Menü hängt an `body`, fest unter dem Plus: In der Ablauf-Karte schnitt deren Rand es ab (Test-Instanz,
 * 30.10.2026). Beim Scrollen ginge es sonst mit dem Plus auseinander – dann schließt es.
 */
function ZeilenKnoepfe({ label, aktionen }: { label: string; aktionen: ZeilenAktionen }) {
  const { offen, setOffen, rahmen, menue } = useAufklapp();
  const plus = useRef<HTMLButtonElement>(null);
  const [stelle, setStelle] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!offen) return;
    const zu = () => setOffen(false);
    window.addEventListener('scroll', zu, true);
    window.addEventListener('resize', zu);
    return () => {
      window.removeEventListener('scroll', zu, true);
      window.removeEventListener('resize', zu);
    };
  }, [offen, setOffen]);

  function umschalten(): void {
    const r = plus.current?.getBoundingClientRect();
    if (r) setStelle({ top: r.bottom, right: window.innerWidth - r.right });
    setOffen((o) => !o);
  }

  return (
    <div ref={rahmen} className={`${styles.zeilenKnoepfe}${offen ? ` ${styles.offen}` : ''}`}>
      <button
        type="button"
        className={styles.zeilenLoeschen}
        aria-label={`„${label}“ löschen`}
        title="Löschen"
        onClick={aktionen.loeschen}
      >
        <Icon name="trash" size={15} stroke={2} />
      </button>
      <button
        type="button"
        className={styles.zeilenPlus}
        aria-label={`Bei „${label}“ einfügen`}
        title="Einfügen"
        aria-haspopup="menu"
        aria-expanded={offen}
        ref={plus}
        onClick={umschalten}
      >
        <Icon name="plus" size={16} stroke={2.4} />
      </button>
      {offen && (
        <BodyPortal>
          <div
            ref={menue}
            className={styles.zeilenMenue}
            style={stelle ? { top: stelle.top, right: stelle.right } : undefined}
          >
            <MenueListe optionen={aktionen.einfuegen} schliessen={() => setOffen(false)} />
          </div>
        </BodyPortal>
      )}
    </div>
  );
}

/** Eine sortierbare Zeile im Bearbeiten-Modus. Tippen auf den Titel öffnet das Aktionsmenü. */
export function SortableRow<T extends AblaufZeile>({
  item,
  onOpenActions,
  aktionen,
  schmal = false,
  ziehId,
  daten,
}: {
  item: T;
  onOpenActions: (item: T) => void;
  /** Plus und Papierkorb beim Drüberfahren – ohne: keine. */
  aktionen?: ZeilenAktionen;
  /** Schmale Form für die Matrix (E6-6a) – derselbe Inhalt wie `AblaufListe schmal`. */
  schmal?: boolean;
  /** Im Zieh-Bereich der Matrix (E6-6b): eigene Zieh-ID (Spalte + Punkt) und was der Bereich über den Punkt wissen muss. */
  ziehId?: string;
  daten?: Record<string, unknown>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ziehId ?? item.id,
    data: daten,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Nur beim Ziehen – ein festes `opacity: 1` überschrieb das Blass-Machen „weggelassen“ (seit E6-3b, gefunden E6-O1).
    opacity: isDragging ? 0.6 : undefined,
    zIndex: isDragging ? 1 : undefined,
  };
  // An diesem Termin weggelassen (E6-3b): grau wie in der Ansicht.
  const weg = item.weggelassen ? ` ${zeile.weggelassen}` : '';
  // Überschriften bleiben schmale Bänder wie in der Ansicht – nur mit Ziehen-Griff davor,
  // damit sich beim Umschalten in den Bearbeiten-Modus Position und Höhe nicht ändern.
  if (item.isHeader) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`${zeile.sectionBand} ${styles.editBand} ${styles.mitKnoepfen}${weg}`}
      >
        <button
          className={styles.bandHandle}
          {...attributes}
          {...listeners}
          aria-label="Verschieben"
        >
          <Icon name="grip" size={16} />
        </button>
        <button className={styles.bandEdit} onClick={() => onOpenActions(item)}>
          {item.title}
          {item.weggelassen && <WeggelassenHinweis />}
        </button>
        {aktionen && <ZeilenKnoepfe label={itemLabel(item)} aktionen={aktionen} />}
        <button
          className={styles.rowEdit}
          onClick={() => onOpenActions(item)}
          aria-label="Bearbeiten"
        >
          <Icon name="pencil" size={15} stroke={2} />
        </button>
      </div>
    );
  }

  // Normale Zeile (E6-O1, Entwurf Variante 1 / B): Griff links, dann dieselbe Zeitspalte und derselbe Inhalt wie die
  // Ansicht – damit beim Umschalten nichts springt –, rechts nur der Stift (keine Kreise). Antippen öffnet das
  // Punkt-Fenster statt zu den Charts zu führen.
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${zeile.flowRow} ${styles.mitKnoepfen}${item.song ? ' ' + zeile.songRow : ''}${weg}${schmal ? ' ' + styles.schmalZeile : ''}`}
    >
      <button
        className={styles.dragCol}
        data-tour="edit-drag"
        {...attributes}
        {...listeners}
        aria-label="Verschieben"
      >
        <Icon name="grip" size={16} />
      </button>
      <ZeitSpalte item={item} />
      <button className={styles.editBody} data-tour="edit-item" onClick={() => onOpenActions(item)}>
        <ZeilenInhalt item={item} schmal={schmal} />
      </button>
      {aktionen && <ZeilenKnoepfe label={itemLabel(item)} aktionen={aktionen} />}
      <button
        className={styles.rowEdit}
        onClick={() => onOpenActions(item)}
        aria-label="Bearbeiten"
      >
        <Icon name="pencil" size={15} stroke={2} />
      </button>
    </div>
  );
}
