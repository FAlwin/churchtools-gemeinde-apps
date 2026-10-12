/**
 * „Voller Ablauf": alle Punkte mit Uhrzeit, Dauer, Notiz und Zuständigen – wie in ChurchTools, nur
 * aufgeräumt (#198 – vorher in `pages/Setlist.tsx`). Lieder sind antippbar (→ Charts).
 *
 * Die Uhrzeit (`item.time`) ist bereits serverseitig richtig: In ChurchTools ausgeblendete Punkte
 * (Auge) liefern gar keine Zeit.
 *
 * Änderungen seit dem letzten Ansehen zeigt seit 12.10.2026 ein kurzer Hinweis unten (`AblaufHinweis`)
 * samt Schildchen „neu"/„geändert" am Punkt – beide stehen ein paar Sekunden und verschwinden zusammen
 * (Alwin: „nur ein kurzer Hinweis und fertig"). Vorher leuchteten Punkte auf und entfernte zerfielen in
 * Partikel – das Abfotografieren dafür ließ die ChurchTools-Erweiterung hängen.
 */
import { Fragment, useEffect, useState } from 'react';
import type { AgendaItem } from '@shared/types/index';
import { itemLabel } from '../utils/agendaItemTitle';
import { vanishedRows, type ShownRow } from '../utils/vanishedRows';
import { beginnStelle } from '../utils/vorlauf';
import {
  hatAenderungen,
  meldungAus,
  meldungBereinigen,
  zusammenfassen,
  type AenderungsMeldung,
} from '../utils/ablaufAenderungen';
import { BeginnLinie, ItemTitle, ResponsibleLine } from './AgendaRowParts';
import { AblaufHinweis } from './AblaufHinweis';
import { useKurzerHinweis } from '../hooks/useKurzerHinweis';
import styles from '../pages/Setlist.module.scss';

export function AgendaFullView({
  items,
  eventId,
  beginn,
  onSelect,
  onSichtbar,
}: {
  items: AgendaItem[];
  eventId: number;
  /** Uhrzeit des Veranstaltungsbeginns („10:00") für die Linie nach dem Vorlauf (#423). */
  beginn?: string;
  onSelect: (songIndex: number) => void;
  /**
   * Meldet, ob die Ansicht steht (`true` nach dem Einhängen, `false` beim Aushängen). Erst dann darf
   * der Stand als „gesehen" gelten: Die Ablaufseite wird beim Start nachgeladen, die Daten kommen
   * oft vorher an – ohne dieses Signal war der Stand schon gemerkt und seine Markierungen entfernt,
   * bevor die Ansicht sie zeigen konnte (im Browser gefunden, 12.10.2026).
   */
  onSichtbar?: (sichtbar: boolean) => void;
}) {
  useEffect(() => {
    onSichtbar?.(true);
    return () => onSichtbar?.(false);
  }, [onSichtbar]);
  let songIndex = -1;
  // Lokal erkannte Löschungen (#178): Punkte, die seit dem Gesehen-Stand hinzukamen und wieder
  // gelöscht wurden, kennt der Server nicht → er liefert für sie KEINEN removed-Platzhalter. Die Ansicht
  // merkt sich deshalb selbst, was sie zuletzt gezeigt hat, damit auch solche Punkte als „Entfernt"
  // gemeldet werden statt kommentarlos zu verschwinden.
  const [stand, setStand] = useState(() => abgleichen(null, eventId, items));
  // SYNCHRON während des Renderns abgleichen (NICHT useEffect): sonst kommt die Meldung einen Frame zu
  // spät. Bedingtes setState im Render ist das dokumentierte „State an geänderte Props
  // anpassen"-Muster – gleiche #113-Lektion wie in usePageDraw. Der Vergleichsstand liegt dabei im
  // ZUSTAND, nicht in einem Ref: Ein Ref ist nach dem ersten von zwei Durchläufen (StrictMode,
  // unterbrochenes Rendern) schon umgestellt, und der zweite verwarf das Ergebnis – die Schildchen
  // kamen nie an (im Browser gefunden, 12.10.2026).
  let aktuell = stand;
  if (stand.eventId !== eventId || stand.items !== items) {
    aktuell = abgleichen(stand, eventId, items);
    setStand(aktuell);
  }
  const meldung = aktuell.meldung;
  const zusammenfassung = zusammenfassen(meldung);
  const sichtbar = useKurzerHinweis(
    hatAenderungen(zusammenfassung)
      ? JSON.stringify([
          [...meldung.neu],
          [...meldung.geaendert],
          meldung.entfernt.map((e) => e.id),
        ])
      : '',
  );
  const zeilen = items.filter((i) => !i.removed);
  // Die Linie „Beginn" vor dem ersten Punkt nach dem Vorlauf (#423) – nur, wenn es Vorlauf gibt.
  const stelle = beginnStelle(zeilen);
  return (
    <div className={styles.flowList}>
      {sichtbar && <AblaufHinweis aenderungen={zusammenfassung} />}
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
    // Neu/geändert/verschoben (#161): ein Schildchen, solange der Hinweis unten steht – keine Bewegung.
    const schild = !sichtbar
      ? null
      : meldung.neu.has(item.id)
        ? 'neu'
        : meldung.geaendert.has(item.id)
          ? 'geändert'
          : null;
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

/** Was die Ansicht zuletzt gezeigt hat – und was die letzte Aktualisierung gebracht hat. */
interface Abgleich {
  eventId: number;
  items: AgendaItem[];
  rows: ShownRow[];
  meldung: AenderungsMeldung;
}

/** Nimmt einen neuen Stand auf; bei Terminwechsel/Erstaufbau frisch und ohne „lokal entfernt". */
function abgleichen(vorher: Abgleich | null, eventId: number, items: AgendaItem[]): Abgleich {
  const rows: ShownRow[] = items
    .filter((i) => !i.removed)
    // Gleiche Bezeichnung wie in der Liste (#215).
    .map((i) => ({ id: i.id, title: itemLabel(i) }));
  const gleicherTermin = vorher !== null && vorher.eventId === eventId;
  const weg = gleicherTermin ? vanishedRows(vorher.rows, new Set(items.map((i) => i.id))) : [];
  const neu = meldungAus(items, weg);
  // Nichts Neues (etwa die Markierungen nach dem Gesehen-Merken entfernt): laufende Meldung behalten.
  const meldung =
    gleicherTermin && !hatAenderungen(zusammenfassen(neu))
      ? meldungBereinigen(vorher.meldung, items)
      : neu;
  return { eventId, items, rows, meldung };
}
