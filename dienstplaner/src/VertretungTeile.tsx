import { useState } from 'react';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { Icon } from '@ui/icons/icons';
import { kachel, tagKurz } from '@shared/ct/datum';
import type { EigenerDienst } from './TauschTeile';
import {
  vertretungsZeilenSchluessel,
  type OffeneVertretung,
  type VertretungZugriff,
} from './useVertretung';
import { VertretungFenster } from './VertretungFenster';
import start from './Startseite.module.scss';
import styles from './VertretungTeile.module.scss';

/**
 * **„Vertretung suchen“ am eigenen, zugesagten Dienst** (E5c-6, Entwurf Abschnitt 1): ein zweiter leiser Link-Knopf neben
 * „Tauschen“ (`TauschAmDienst` setzt ihn dazu); er öffnet das Fenster. Nur bei **zugesagten** Diensten – für eine offene Anfrage
 * gibt es „Absagen“.
 */
export function VertretungKnopf({
  d,
  vertretung,
}: {
  d: EigenerDienst;
  vertretung: VertretungZugriff;
}) {
  const [offen, setOffen] = useState(false);
  return (
    <>
      <FensterKnopf art="link" onClick={() => setOffen(true)}>
        <Icon name="flag" size={13} />
        Vertretung suchen
      </FensterKnopf>
      {offen && <VertretungFenster d={d} vertretung={vertretung} onClose={() => setOffen(false)} />}
    </>
  );
}

/**
 * **Eine gesuchte Vertretung in „Für dich offen“** (E5c-6, Entwurf Abschnitt 4): Datums-Kachel, Dienst, Termin und darunter
 * das Band „<Name> sucht eine Vertretung“ mit **einem** gefüllten Knopf „Übernehmen“. Sichtbar für jeden aus dem Team des
 * Dienstes – nicht nur für die Gefragten (`offeneVertretungen`). Wer zu spät drückt, liest „Schon übernommen – danke!“.
 */
export function VertretungEingang({
  g,
  vertretung,
}: {
  g: OffeneVertretung;
  vertretung: VertretungZugriff;
}) {
  const k = vertretungsZeilenSchluessel(g);
  const laeuft = vertretung.laeuft(k);
  const fehler = vertretung.fehler(k);
  const kk = kachel(g.termin.tag);
  return (
    <li className={start.zeile}>
      <DatumKachel tag={kk.tag} monat={kk.monat} />
      <div className={start.mitte}>
        <b>{g.dienst}</b>
        <small>
          {g.termin.name} · {tagKurz(g.termin.tag)} · {g.termin.uhrzeit} Uhr
        </small>
        <div className={styles.band}>
          <span className={styles.text}>
            <Icon name="flag" size={13} />
            <span>
              {/* `strong`, nicht `b`: `.mitte b` ist die Titelzeile der Startseite (15 px). */}
              <strong>{g.name}</strong> sucht eine Vertretung
            </span>
          </span>
          <FensterKnopf
            className={styles.uebernehmen}
            disabled={laeuft}
            onClick={() => void vertretung.uebernehmen(g)}
          >
            {laeuft ? 'Wird übernommen …' : 'Übernehmen'}
          </FensterKnopf>
        </div>
        {fehler && (
          <p className={styles.fehler} role="alert">
            {fehler}
          </p>
        )}
      </div>
    </li>
  );
}
