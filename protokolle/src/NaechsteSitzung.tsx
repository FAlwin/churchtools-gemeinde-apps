import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { Icon } from '@ui/icons/icons';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { kachelVon, wannLang } from './anzeige';
import styles from './NaechsteSitzung.module.scss';

/**
 * **„Nächste Sitzung“ im Bereich Termine** (Bauplan S5-2, Entwurf 7) – die festgelegte nächste Sitzung mit Einladungen
 * und Zusagen, sonst für die Leitung der Knopf „Nächste Sitzung festlegen“.
 */
export function NaechsteSitzung({
  naechste,
  zeitzone,
  onFestlegen,
}: {
  naechste: Sitzung | null;
  zeitzone: string;
  /** Nur für die Leitung, wenn die Gruppe einen Kalender hat. */
  onFestlegen?: () => void;
}) {
  if (naechste) {
    const k = kachelVon(naechste.beginn, zeitzone);
    const zugesagt = naechste.anfragen.filter((a) => a.antwort === 'zugesagt').length;
    return (
      <div className={styles.naechste}>
        <h4>Nächste Sitzung</h4>
        <div className={styles.zeile}>
          <DatumKachel tag={k.tag} monat={k.monat} />
          <span>
            <b>{wannLang(naechste.beginn, zeitzone)}</b>
            <small>
              {naechste.titel}
              {naechste.anfragen.length
                ? ` · Einladung an ${naechste.anfragen.length} · ${zugesagt} zugesagt`
                : ''}
              {naechste.treffen !== null ? ' · Gruppentreffen angelegt' : ''}
            </small>
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.naechste}>
      <h4>Nächste Sitzung</h4>
      {onFestlegen ? (
        <>
          <p>
            Einladung (Besprechungsanfrage) und Gruppentreffen werden in ChurchTools angelegt.
            Offene To-Dos wandern mit.
          </p>
          <div>
            <button type="button" className={styles.knopf} onClick={onFestlegen}>
              <Icon name="calendar" size={18} />
              Nächste Sitzung festlegen
            </button>
          </div>
        </>
      ) : (
        <p>Noch nicht festgelegt.</p>
      )}
    </div>
  );
}
