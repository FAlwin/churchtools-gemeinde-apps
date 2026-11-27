import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { Etikett } from '@ui/bedienung/Etikett';
import { Icon } from '@ui/icons/icons';
import { tagPunkt, datumText } from '@shared/ct/datum';
import { gemeindeZeitzone, ortszeitAus } from '@shared/ct/zeit';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { kachelVon, uhrzeit } from './anzeige';
import styles from './Sitzungen.module.scss';

/**
 * Eine Zeile in „Kommend“ und „Protokolle“ des Reiters „Sitzungen“. Mit `gruppe` (Ansicht „Alle Gruppen“) steht der
 * Name der Gruppe als Etikett darunter – in der Ansicht einer einzelnen Gruppe weiß man ihn ohnehin.
 */
export function SitzungZeile({
  s,
  vorschlaege = 0,
  uebernommen = 0,
  gruppe,
  onOeffnen,
}: {
  s: Sitzung;
  /** Offene Vorschläge für diese Sitzung (S5-4). */
  vorschlaege?: number;
  /** Übernommene Vorschläge für diese Sitzung – sie stehen nicht mehr in der Karte (W8c). */
  uebernommen?: number;
  /** Name der Gruppe – nur in „Alle Gruppen“. */
  gruppe?: string;
  onOeffnen: () => void;
}) {
  const k = kachelVon(s.beginn, gemeindeZeitzone());
  const status = s.kopf?.status;
  return (
    <li>
      <button type="button" className={styles.zeile} onClick={onOeffnen}>
        <DatumKachel tag={k.tag} monat={k.monat} gedimmt={!s.kopf} />
        <span className={styles.text}>
          <b>{s.titel}</b>
          <small>
            {datumText(ortszeitAus(s.beginn, gemeindeZeitzone()).slice(0, 10))} ·{' '}
            {uhrzeit(s.beginn, gemeindeZeitzone())}
            {status === 'frei' && s.kopf?.freigabe
              ? ` · freigegeben am ${tagPunkt(s.kopf.freigabe.am.slice(0, 10))}`
              : ''}
          </small>
          {/* Unter dem Datum, nicht daneben – am Handy drückte das Schild den Titel zusammen. */}
          {(gruppe || vorschlaege > 0 || uebernommen > 0) && (
            <span className={styles.vorschlaege}>
              {gruppe && <Etikett ton="blau">{gruppe}</Etikett>}
              {vorschlaege > 0 && (
                <Etikett ton="blau">
                  {vorschlaege} {vorschlaege === 1 ? 'Vorschlag' : 'Vorschläge'} offen
                </Etikett>
              )}
              {uebernommen > 0 && (
                <Etikett ton="gruen">
                  {uebernommen} {uebernommen === 1 ? 'Vorschlag' : 'Vorschläge'} übernommen
                </Etikett>
              )}
            </span>
          )}
        </span>
        {status === 'entwurf' && <Etikett ton="neutral">Entwurf</Etikett>}
        {status === 'geplant' && <Etikett ton="neutral">geplant</Etikett>}
        {status === 'frei' && <Etikett ton="gruen">freigegeben</Etikett>}
        <Icon name="chev-right" size={18} />
      </button>
    </li>
  );
}
