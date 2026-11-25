import { useMemo, useState } from 'react';
import { tagPunkt } from '@shared/ct/datum';
import type { Eintrag } from '@shared/protokolle/termine';
import {
  vorlageFuerAlle,
  vorlageFuerZeile,
  type EventVorlage,
} from '@shared/protokolle/terminEvents';
import { einzeltermine, MAX_EINZELTERMINE } from '@shared/protokolle/terminReihe';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import type { Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { ConfirmDialog } from '@ui/fenster/ConfirmDialog';
import formular from './TerminFormular.module.scss';
import styles from './TerminEvents.module.scss';

interface Props {
  e: Eintrag;
  onAendern: (neu: Eintrag) => void;
  vorlagen: readonly EventVorlage[];
  laedt: boolean;
  fehler: Fehlermeldung | null;
  onNeu: () => void;
  deaktiviert: boolean;
}

/**
 * **Der Reiter „Events“ des ChurchTools-Dialogs „Termin erstellen“** (W15-3): Die Tabelle **Event-Datum | Eventvorlage** hat
 * **eine Zeile je Einzeltermin der Reihe** (Datum und Uhrzeit untereinander, ganztägig nur das Datum) und eine Auswahl der
 * Eventvorlagen; der leere Eintrag oben heißt „für diesen Termin kein Event“. Wählt man eine Vorlage und es gibt mehr als
 * eine Zeile, fragt das Fenster wie ChurchTools, ob sie **für alle Termine** gelten soll (Bestätigen = alle Zeilen,
 * Abbrechen = nur diese). Die Rechnung der Zeilen steht in `@shared/protokolle/terminReihe`, die Regeln in `terminEvents`.
 * **Die Vorlage mit der Nummer 0 („Standard“) ist gültig** – darum ist die Auswahl über den Text der Nummer geführt, nicht
 * über „leer oder nicht“.
 */
export function TerminEvents(p: Props) {
  const { e } = p;
  const { tage, abgeschnitten } = useMemo(() => einzeltermine(e), [e]);
  const [frage, setFrage] = useState<{ tag: string; id: number } | null>(null);

  const waehlen = (tag: string, wert: string) => {
    if (wert === '') {
      p.onAendern({ ...e, events: vorlageFuerZeile(e.events, tag, null) });
      return;
    }
    const id = Number(wert);
    p.onAendern({ ...e, events: vorlageFuerZeile(e.events, tag, id) });
    if (tage.length > 1) setFrage({ tag, id });
  };

  return (
    <div className={styles.events}>
      <p className={styles.leise}>
        Hier können für Events Veranstaltungen erstellt und aufgerufen werden. Um Dienste zu
        erstellen, bitte eine entsprechende Vorlage auswählen.
      </p>
      {p.fehler && (
        <p className={styles.leise} role="alert">
          {p.fehler.text} <TextKnopf onClick={p.onNeu}>Noch einmal versuchen</TextKnopf>
        </p>
      )}
      <table className={styles.tabelle}>
        <thead>
          <tr>
            <th scope="col">Event-Datum</th>
            <th scope="col">Eventvorlage</th>
          </tr>
        </thead>
        <tbody>
          {tage.map((tag) => (
            <tr key={tag}>
              <td data-label="Event-Datum" className={styles.datum}>
                <div>
                  <span>{tagPunkt(tag)}</span>
                  {!e.ganztaegig && <span className={styles.uhr}>{e.von}</span>}
                </div>
              </td>
              <td data-label="Eventvorlage">
                <select
                  className={formular.eingabe}
                  aria-label={`Eventvorlage ${tagPunkt(tag)}`}
                  value={e.events[tag] === undefined ? '' : String(e.events[tag])}
                  disabled={p.deaktiviert || p.laedt}
                  onChange={(ev) => waehlen(tag, ev.target.value)}
                >
                  <option value="">{p.laedt ? 'wird geladen …' : ''}</option>
                  {p.vorlagen.map((v) => (
                    <option key={v.id} value={String(v.id)}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {abgeschnitten && (
        <p className={styles.leise} role="status">
          Es werden nur die ersten {MAX_EINZELTERMINE} Termine gezeigt.
        </p>
      )}
      {frage && (
        <ConfirmDialog
          title="Achtung"
          message="Soll die Vorlage für alle Termine übernommen werden?"
          confirmLabel="Bestätigen"
          cancelLabel="Abbrechen"
          harmlos
          onConfirm={() => {
            p.onAendern({ ...e, events: vorlageFuerAlle(e, frage.id) });
            setFrage(null);
          }}
          onCancel={() => setFrage(null)}
        />
      )}
    </div>
  );
}
