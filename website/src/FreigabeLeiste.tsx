import { Etikett } from '@ui/bedienung/Etikett';
import { MehrMenue } from '@ui/bedienung/MehrMenue';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import { datumUhrText } from '@shared/ct/zeit';
import { kannEinreichen, type OnlineLage } from '@shared/website/freigabe';
import type { SeitenStatus } from '@shared/website/status';
import { seitenEtikett, werUndWann } from './freigabeAnzeige';
// Dasselbe Band wie bei der Sperre (`SperrBaender`) – eine Gestalt für alle Hinweise unter der Werkzeugleiste.
import styles from './SperrBaender.module.scss';

/**
 * **Freigabe in der Werkzeugleiste einer Seite** (Bauplan Website W3b-2): das Etikett – wo steht die Seite? – und der eine
 * Knopf, der zur Person passt:
 * - **Redakteur:** „Zur Prüfung einreichen“ – nur, wenn die Seite vom Online-Stand abweicht oder nie online war und nicht schon
 *   eingereicht ist (`kannEinreichen`).
 * - **Leitung/Admin:** „Veröffentlichen“ – ruhig im „⋯“-Menü, solange die Seite nicht schon so online steht.
 */
export function FreigabeLeiste({
  status,
  lage,
  darfFreigeben,
  beschaeftigt,
  gesperrt,
  onEinreichen,
  onVeroeffentlichen,
}: {
  status: SeitenStatus | null;
  lage: Exclude<OnlineLage, 'nurOnline'> | null;
  darfFreigeben: boolean;
  /** Etwas läuft gerade (einreichen, veröffentlichen …). */
  beschaeftigt: boolean;
  /** Etwas an der Seite ist noch nicht gespeichert – dann geht weder Einreichen noch Veröffentlichen. */
  gesperrt: boolean;
  onEinreichen: () => void;
  onVeroeffentlichen: () => void;
}) {
  const handy = useMedienAbfrage(HANDY_BREITE);
  const e = seitenEtikett(status, lage);
  const aus = beschaeftigt || gesperrt;
  return (
    <>
      {e && (
        <Etikett ton={e.ton} title={e.title}>
          {e.text}
        </Etikett>
      )}
      {!darfFreigeben && kannEinreichen(lage, status) && (
        <FensterKnopf disabled={aus} onClick={onEinreichen}>
          Zur Prüfung einreichen
        </FensterKnopf>
      )}
      {darfFreigeben && lage !== 'gleich' && (
        <MehrMenue
          handy={handy}
          optionen={[
            {
              label: 'Veröffentlichen',
              symbol: <Icon name="check" size={16} />,
              gesperrt: aus,
              onClick: onVeroeffentlichen,
            },
          ]}
        />
      )}
    </>
  );
}

/**
 * **Das Band unter der Werkzeugleiste:** nach „zurück“ die Anmerkung der Leitung (sie bleibt sichtbar, bis die Seite wieder
 * eingereicht ist); beim angefragten Löschen sagt es der Leitung, was zu tun ist, und dem Redakteur, dass es läuft.
 */
export function FreigabeBand({
  status,
  darfFreigeben,
}: {
  status: SeitenStatus | null;
  darfFreigeben: boolean;
}) {
  if (status?.zustand === 'zurueck')
    return (
      <div className={styles.band} role="status">
        <p>
          <strong>Zurück {werUndWann(status)}:</strong> {status.anmerkung}
        </p>
      </div>
    );
  if (status?.zustand === 'loeschenAngefragt')
    return (
      <div className={styles.band} role="status">
        <p>
          {darfFreigeben
            ? `${status.name} bittet darum, diese Seite zu löschen (${datumUhrText(status.zeit)}). Entscheiden kannst du unter „Freigaben“.`
            : 'Du hast angefragt, diese Seite zu löschen. Die Leitung entscheidet – bis dahin bleibt sie, wie sie ist.'}
        </p>
      </div>
    );
  return null;
}
