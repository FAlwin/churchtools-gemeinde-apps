import { useContext, useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { tagPunkt } from '@shared/ct/datum';
import { tagAusIso } from '@shared/ct/zeit';
import { istUeberfaellig, type Aufgabe } from '@shared/protokolle/aufgaben';
import {
  festeAufgabenAus,
  festesProtokollAus,
  offeneVonFrueher,
} from '@shared/protokolle/festePunkte';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { VERWEIS_TEXT } from './anzeige';
import { FestePunkteKontext, type FestePunkteWert } from './festePunkteKontext';
import { StatusKreis } from './StatusKreis';
import ansicht from './ProtokollAnsicht.module.scss';
import styles from './FesterPunkt.module.scss';

/**
 * **Ein fester Punkt** (Bauplan S4-3a, Entwurf 7) – im Editor und in der Lese-Ansicht derselbe Baustein:
 * - **„Offene To-Dos“:** die offenen To-Dos der Gruppe von früher mit Status-Kreis, Wer und Bis; darunter eingeklappt
 *   „Seit der Sitzung am … erledigt“. Abhaken nur im Editor (`abhaken`); in der Lese-Ansicht nur Anzeige (Alwin
 *   26.10.2026 – der Kreis dort kommt mit S7).
 * - **„Letztes Protokoll“:** Titel, Datum, Freigabe – „Öffnen“ zeigt es im Fenster.
 *
 * Was drinsteht, bestimmt `offeneVonFrueher` bzw. `letztesProtokoll` (bis zur Freigabe live, danach festgehalten).
 */
export function FesterPunkt({
  art,
  fest,
  abhaken,
}: {
  art: unknown;
  fest: unknown;
  abhaken: boolean;
}) {
  const w = useContext(FestePunkteKontext);
  if (!w) return <p className={ansicht.verweis}>{VERWEIS_TEXT[String(art)] ?? 'Fester Punkt'}</p>;
  return art === 'letztes-protokoll' ? (
    <LetztesProtokoll w={w} fest={fest} />
  ) : (
    <OffeneToDos w={w} fest={fest} abhaken={abhaken} />
  );
}

function OffeneToDos({
  w,
  fest,
  abhaken,
}: {
  w: FestePunkteWert;
  fest: unknown;
  abhaken: boolean;
}) {
  const [auf, setAuf] = useState(false);
  const r = offeneVonFrueher({
    aufgaben: w.aufgaben,
    gruppe: w.gruppe,
    sitzung: w.sitzung,
    seit: w.letztes?.beginn ?? null,
    heute: w.heute,
    fest: festeAufgabenAus(fest),
  });
  const zeile = (a: Aufgabe) => <Zeile key={a.id} a={a} w={w} abhaken={abhaken} />;
  return (
    <div className={styles.punkt} contentEditable={false}>
      <div className={styles.kopf}>
        <Icon name="todo-liste" size={17} />
        Offene To-Dos von früher
        <span className={styles.anzahl}>{r.offen.length}</span>
      </div>
      {r.offen.length ? (
        <ul className={styles.liste}>{r.offen.map(zeile)}</ul>
      ) : (
        <p className={styles.leise}>Nichts offen von früher.</p>
      )}
      {r.erledigt.length > 0 && r.seit && (
        <>
          <button
            type="button"
            className={styles.aufklappen}
            aria-expanded={auf}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setAuf((x) => !x)}
          >
            Seit der Sitzung am {tagPunkt(tagAusIso(r.seit, w.zeitzone))} erledigt ·{' '}
            {r.erledigt.length}
            <Icon name={auf ? 'chev-down' : 'chev-right'} size={15} />
          </button>
          {auf && <ul className={styles.liste}>{r.erledigt.map(zeile)}</ul>}
        </>
      )}
    </div>
  );
}

function Zeile({ a, w, abhaken }: { a: Aufgabe; w: FestePunkteWert; abhaken: boolean }) {
  const wer = [
    ...(w.name ? a.wer.map((p) => w.name?.(p) ?? null).filter((n): n is string => !!n) : []),
    ...(a.extern ? [`${a.extern} (extern)`] : []),
  ];
  const ueber = istUeberfaellig(a, w.heute);
  const aendern = abhaken ? w.status : undefined;
  return (
    <li className={styles.zeile}>
      <StatusKreis status={a.status} onWechsel={aendern ? (neu) => aendern(a, neu) : undefined} />
      <span className={styles.text}>
        <span className={a.status === 'erledigt' ? styles.erledigt : undefined}>{a.text}</span>
        {(wer.length > 0 || a.bis) && (
          <small>
            {wer.join(', ')}
            {wer.length > 0 && a.bis ? ' · ' : ''}
            {a.bis && (
              <span className={ueber ? styles.ueber : undefined}>
                {ueber ? 'überfällig · ' : 'bis '}
                {tagPunkt(a.bis)}
              </span>
            )}
          </small>
        )}
      </span>
    </li>
  );
}

function LetztesProtokoll({ w, fest }: { w: FestePunkteWert; fest: unknown }) {
  const f = festesProtokollAus(fest);
  // Festgehalten: genau das damalige – fehlt es inzwischen, sagt der Punkt das, statt ein anderes zu zeigen.
  const s: Sitzung | null | 'weg' = !f
    ? w.letztes
    : f.sitzung === null
      ? null
      : (w.protokolle.find((p) => p.kopf?.sitzung === f.sitzung) ?? 'weg');
  return (
    <div className={styles.punkt} contentEditable={false}>
      <div className={styles.letztes}>
        <Icon name="dokument" size={17} />
        {s === null && <span className={styles.leise}>Keine frühere Sitzung mit Protokoll.</span>}
        {s === 'weg' && (
          <span className={styles.leise}>Das damalige Protokoll gibt es nicht mehr.</span>
        )}
        {s !== null && s !== 'weg' && (
          <>
            <span className={styles.text}>
              <b>{s.titel}</b>
              <small>
                vom {tagPunkt(tagAusIso(s.beginn, w.zeitzone))}
                {s.kopf?.freigabe
                  ? ` · freigegeben am ${tagPunkt(tagAusIso(s.kopf.freigabe.am, w.zeitzone))}`
                  : ''}
              </small>
            </span>
            {w.oeffnen && (
              <button
                type="button"
                className={styles.oeffnen}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => w.oeffnen?.(s)}
              >
                Öffnen
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
