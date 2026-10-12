/**
 * „Voller Ablauf": alle Punkte mit Uhrzeit, Dauer, Notiz und Zuständigen – wie in ChurchTools, nur
 * aufgeräumt (#198 – vorher in `pages/Setlist.tsx`). Lieder sind antippbar (→ Charts).
 *
 * Die Uhrzeit (`item.time`) ist bereits serverseitig richtig: In ChurchTools ausgeblendete Punkte
 * (Auge) liefern gar keine Zeit.
 *
 * Änderungen seit dem letzten Ansehen zeigt seit 12.10.2026 eine ruhige Leiste oben (`AblaufHinweis`)
 * und ein Schildchen „neu"/„geändert" am Punkt. Vorher leuchteten Punkte auf und entfernte zerfielen
 * in Partikel – das Abfotografieren dafür ließ die ChurchTools-Erweiterung hängen (Alwin).
 */
import { Fragment, useRef, useState } from 'react';
import type { AgendaItem } from '@shared/types/index';
import { itemLabel } from '../utils/agendaItemTitle';
import { vanishedRows, type ShownRow } from '../utils/vanishedRows';
import { beginnStelle } from '../utils/vorlauf';
import { ablaufAenderungen } from '../utils/ablaufAenderungen';
import { BeginnLinie, ItemTitle, ResponsibleLine } from './AgendaRowParts';
import { AblaufHinweis } from './AblaufHinweis';
import styles from '../pages/Setlist.module.scss';

export function AgendaFullView({
  items,
  eventId,
  beginn,
  onSelect,
}: {
  items: AgendaItem[];
  eventId: number;
  /** Uhrzeit des Veranstaltungsbeginns („10:00") für die Linie nach dem Vorlauf (#423). */
  beginn?: string;
  onSelect: (songIndex: number) => void;
}) {
  let songIndex = -1;
  // Lokal erkannte Löschungen (#178): Punkte, die seit dem Betreten hinzukamen und wieder gelöscht
  // wurden, stehen nicht in der „gesehen"-Basislinie → der Server liefert für sie KEINEN
  // removed-Platzhalter. Die Ansicht merkt sich deshalb selbst, was sie zuletzt gezeigt hat, damit
  // auch solche Punkte in der Leiste als „Entfernt" stehen statt kommentarlos zu verschwinden.
  const prevShown = useRef<{ eventId: number; items: AgendaItem[]; rows: ShownRow[] } | null>(null);
  const [localRemoved, setLocalRemoved] = useState<{ id: number; title: string }[]>([]);
  // SYNCHRON während des Renderns abgleichen (NICHT useEffect): sonst zeigt ein Frame die Leiste ohne
  // den gerade verschwundenen Punkt. Bedingtes setState im Render ist das dokumentierte „State an
  // geänderte Props anpassen"-Muster – gleiche #113-Lektion wie in usePageDraw.
  const prev = prevShown.current;
  if (!prev || prev.eventId !== eventId || prev.items !== items) {
    const shown: ShownRow[] = items
      .filter((i) => !i.removed)
      // Gleiche Bezeichnung wie in der Liste (#215).
      .map((i) => ({ id: i.id, title: itemLabel(i) }));
    prevShown.current = { eventId, items, rows: shown };
    if (!prev || prev.eventId !== eventId) {
      // Terminwechsel/Erstaufbau: nichts melden, nur Merkstand setzen.
      if (localRemoved.length) setLocalRemoved([]);
    } else {
      const presentIds = new Set(items.map((i) => i.id));
      const vanished = vanishedRows(prev.rows, presentIds);
      setLocalRemoved((cur) => {
        // Wieder aufgetauchte IDs (rückgängig gemacht) räumen; bleibt sonst, bis der Termin wechselt.
        const kept = cur.filter((c) => !presentIds.has(c.id));
        const fresh = vanished
          .filter((v) => !kept.some((c) => c.id === v.id))
          .map((v) => ({ id: v.id, title: v.title }));
        return fresh.length || kept.length !== cur.length ? [...kept, ...fresh] : cur;
      });
    }
  }
  const zeilen = items.filter((i) => !i.removed);
  // Die Linie „Beginn" vor dem ersten Punkt nach dem Vorlauf (#423) – nur, wenn es Vorlauf gibt.
  const stelle = beginnStelle(zeilen);
  return (
    <div className={styles.flowList}>
      <AblaufHinweis aenderungen={ablaufAenderungen(items, localRemoved)} />
      {zeilen.map((item, i) => (
        <Fragment key={item.id}>
          {i === stelle && <BeginnLinie zeit={beginn} />}
          {zeile(item)}
        </Fragment>
      ))}
      {stelle === zeilen.length && <BeginnLinie zeit={beginn} />}
    </div>
  );

  function zeile(item: AgendaItem) {
    const showTime = !!item.time;
    // Neu/geändert/verschoben seit dem letzten Ansehen (#161): ein festes Schildchen, keine Bewegung.
    const schild = item.neu ? 'neu' : item.changed ? 'geändert' : null;
    const tag = schild && <span className={styles.aenderungsTag}>{schild}</span>;
    const vl = item.vorBeginn ? ` ${styles.vorlauf}` : '';
    if (item.isHeader) {
      return (
        <div key={item.id} className={styles.sectionBand}>
          {showTime && <span className={styles.bandTime}>{item.time}</span>}
          {item.title}
          {tag}
        </div>
      );
    }
    const timeCol = <div className={styles.flowTime}>{showTime ? item.time : ''}</div>;
    const body = (
      <div className={styles.flowBody}>
        <div className={styles.flowHead}>
          <ItemTitle item={item} />
          {item.song && <span className={styles.flowSongTag}>🎵</span>}
          {tag}
          {item.durationMin && <span className={styles.flowDur}>{item.durationMin} Min</span>}
        </div>
        {item.note && <div className={styles.flowNote}>{item.note}</div>}
        <ResponsibleLine entries={item.responsible} />
      </div>
    );
    if (item.song) {
      songIndex += 1;
      const idx = songIndex;
      return (
        <button
          key={item.id}
          className={`${styles.flowRowBtn} ${styles.songRow}${vl}`}
          data-tour={idx === 0 ? 'setlist-song' : undefined}
          onClick={() => onSelect(idx)}
        >
          {timeCol}
          {body}
        </button>
      );
    }
    return (
      <div key={item.id} className={`${styles.flowRow}${vl}`}>
        {timeCol}
        {body}
      </div>
    );
  }
}
