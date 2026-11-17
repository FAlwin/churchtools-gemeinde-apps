import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { useLaden } from '@ui/ct/useLaden';
import { tagPunkt } from '@shared/ct/datum';
import { heuteImKalender, tagAusIso } from '@shared/ct/zeit';
import { NOCH_OHNE_TAGE, ohneProtokollZeitraum } from '@shared/protokolle/fruehere';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import { kachelVon } from './anzeige';
import { FruehereText } from './FruehereText';
import { koepfeAus, sitzungenOhneProtokoll } from './lesen';
import styles from './Fruehere.module.scss';

/**
 * **Block „Noch ohne Protokoll“** (v1.0.1, Entwurf `fruehere-treffen-v1`) – nur für die Leitung, über „Kommend“:
 * zurückliegende Sitzungen ohne Protokoll seit dem letzten freigegebenen (sonst 28 Tage), je mit „Protokoll beginnen“.
 * Leer → gar nichts. Wird **für sich** geladen: Scheitert es, steht hier ein Hinweis und der Rest der Seite bleibt
 * nutzbar (vorübergehend ist nicht leer – kein stilles Verschwinden).
 */
export function NochOhneProtokoll({
  gruppe,
  daten,
  zeitzone,
  jetzt = new Date(),
  onBeginnen,
}: {
  gruppe: { id: number };
  daten: { kommend: Sitzung[]; protokolle: Sitzung[]; kalender: number | null };
  zeitzone: string;
  jetzt?: Date;
  onBeginnen: (s: Sitzung) => void;
}) {
  const heute = heuteImKalender(jetzt, zeitzone);
  const zeitraum = ohneProtokollZeitraum({ protokolle: daten.protokolle, heute, zeitzone });
  // Neu geladen wird, wenn sich die Sitzungen der Gruppe ändern (stilles Nachladen) oder der Zeitraum.
  const von = zeitraum?.von ?? null;
  const bis = zeitraum?.bis ?? null;
  const { stand, neu } = useLaden(
    () =>
      von !== null && bis !== null
        ? sitzungenOhneProtokoll({
            gruppe: gruppe.id,
            kalender: daten.kalender,
            koepfe: koepfeAus(daten),
            zeitraum: { von, bis },
            zeitzone,
          }).then((r) => r.sitzungen)
        : null,
    [gruppe.id, daten, von, bis, zeitzone],
  );

  if (stand.art === 'aus' || stand.art === 'laedt') return null;
  if (stand.art === 'fertig' && !stand.daten.length) return null;
  return (
    <section className={styles.karte} aria-labelledby="ohne-protokoll">
      <div className={styles.kartenkopf}>
        <h3 id="ohne-protokoll">Noch ohne Protokoll</h3>
        {stand.art === 'fertig' && <span className={styles.anzahl}>{stand.daten.length}</span>}
      </div>
      {stand.art === 'fehler' ? (
        <div className={styles.fehler}>
          <FehlerKasten fehler={stand.fehler} onNochmal={neu} />
        </div>
      ) : (
        <>
          <p className={styles.untertitel}>
            {zeitraum?.letztes
              ? `Seit dem letzten freigegebenen Protokoll (${tagPunkt(zeitraum.letztes)}) ohne Protokoll geblieben.`
              : `In den letzten ${NOCH_OHNE_TAGE} Tagen ohne Protokoll geblieben.`}
          </p>
          <ul className={styles.liste}>
            {stand.daten.map((s) => {
              const k = kachelVon(s.beginn, zeitzone);
              return (
                <li key={s.schluessel} className={styles.zeile}>
                  <DatumKachel tag={k.tag} monat={k.monat} gedimmt />
                  <FruehereText s={s} zeitzone={zeitzone} heute={heute} />
                  <span className={styles.beginnen}>
                    <button
                      type="button"
                      aria-label={`Protokoll beginnen: ${s.titel}, ${tagPunkt(tagAusIso(s.beginn, zeitzone))}`}
                      onClick={() => onBeginnen(s)}
                    >
                      Protokoll beginnen
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
