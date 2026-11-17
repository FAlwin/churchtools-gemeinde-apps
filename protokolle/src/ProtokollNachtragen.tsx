import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { Icon } from '@ui/icons/icons';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import { useLaden } from '@ui/ct/useLaden';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { monatPlus, monatTitel } from '@shared/ct/datum';
import { heuteImKalender } from '@shared/ct/zeit';
import { monatsZeitraum } from '@shared/protokolle/fruehere';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import type { ProtokollTeil } from '@shared/protokolle/speicher';
import { kachelVon } from './anzeige';
import { FruehereText } from './FruehereText';
import { koepfeAus, sitzungenOhneProtokoll } from './lesen';
import { ProtokollBeginnen } from './ProtokollBeginnen';
import styles from './Fruehere.module.scss';

/**
 * **Fenster „Protokoll nachtragen“** (v1.0.1, Entwurf `fruehere-treffen-v1`) – nur für die Leitung: Monat für Monat
 * (‹ ›, vorwärts nicht über den laufenden Monat hinaus) alle Treffen und Termine **ohne Protokoll**, beliebig weit
 * zurück. Gelesen wird **nur der gezeigte Monat** (bis gestern). Eine Zeile wählen → derselbe Schritt wie „Protokoll
 * beginnen“ (`ProtokollBeginnen`: Vorlage / „Wie letztes Mal“ / leer), im selben Fenster, mit „‹“ zurück zur Auswahl.
 */
export function ProtokollNachtragen({
  gruppeId,
  gruppeName,
  modul,
  kategorie,
  mitarbeit,
  kalender,
  kommend,
  protokolle,
  teile,
  ich,
  zeitzone,
  jetzt = new Date(),
  onBegonnen,
  onClose,
}: {
  gruppeId: number;
  gruppeName: string;
  modul: number;
  kategorie: number;
  mitarbeit: number | null;
  kalender: number | null;
  kommend: readonly Sitzung[];
  protokolle: readonly Sitzung[];
  teile: readonly ProtokollTeil[];
  ich: { person: number; name: string };
  zeitzone: string;
  jetzt?: Date;
  onBegonnen: (sitzung: string) => void;
  onClose: () => void;
}) {
  const heute = heuteImKalender(jetzt, zeitzone);
  const laufend = heute.slice(0, 7);
  const [monat, setMonat] = useState(laufend);
  const [gewaehlt, setGewaehlt] = useState<Sitzung | null>(null);
  // Nach dem ersten Öffnen ersetzen sich Auswahl und „Beginnen“ im selben Fenster – ohne noch einmal einzublenden.
  const [ersetzt, setErsetzt] = useState(false);
  const zeitraum = monatsZeitraum(monat, heute);
  const von = zeitraum?.von ?? null;
  const bis = zeitraum?.bis ?? null;
  const { stand, neu } = useLaden(
    () =>
      von !== null && bis !== null
        ? sitzungenOhneProtokoll({
            gruppe: gruppeId,
            kalender,
            koepfe: koepfeAus({ kommend, protokolle }),
            zeitraum: { von, bis },
            zeitzone,
          })
        : Promise.resolve({ sitzungen: [], treffenNichtFreigegeben: false }),
    [von, bis, gruppeId, kalender, kommend, protokolle, zeitzone],
  );

  if (gewaehlt)
    return (
      <ProtokollBeginnen
        sitzung={gewaehlt}
        gruppeId={gruppeId}
        modul={modul}
        kategorie={kategorie}
        mitarbeit={mitarbeit}
        protokolle={protokolle}
        teile={teile}
        ich={ich}
        zeitzone={zeitzone}
        frueher
        zurueck={() => setGewaehlt(null)}
        onBegonnen={onBegonnen}
        onClose={onClose}
      />
    );

  const wahl = (s: Sitzung) => {
    setErsetzt(true);
    setGewaehlt(s);
  };
  return (
    <Sheet title="Protokoll nachtragen" onClose={onClose} knoepfe={null} einblenden={!ersetzt}>
      <p className={styles.unter}>
        {gruppeName} · Treffen und Termine, zu denen es noch kein Protokoll gibt.
      </p>
      <div className={styles.monat}>
        <button
          type="button"
          className={styles.pfeil}
          aria-label="Voriger Monat"
          onClick={() => setMonat((m) => monatPlus(m, -1))}
        >
          <Icon name="chev-left" size={18} />
        </button>
        <b aria-live="polite">{monatTitel(`${monat}-01`)}</b>
        <button
          type="button"
          className={styles.pfeil}
          aria-label="Nächster Monat"
          disabled={monat >= laufend}
          onClick={() => setMonat((m) => monatPlus(m, 1))}
        >
          <Icon name="chev-right" size={18} />
        </button>
      </div>
      {/* Eine Mindesthöhe, damit ‹ › beim Blättern an derselben Stelle bleiben (das Fenster ist mittig). */}
      <div className={styles.inhalt}>
        {stand.art === 'fehler' && <FehlerKasten fehler={stand.fehler} onNochmal={neu} />}
        {(stand.art === 'laedt' || stand.art === 'aus') && (
          <p className={styles.leise}>Wird geladen …</p>
        )}
        {stand.art === 'fertig' &&
          (stand.daten.sitzungen.length ? (
            <ul className={`${styles.liste} ${styles.fliste}`}>
              {stand.daten.sitzungen.map((s) => {
                const k = kachelVon(s.beginn, zeitzone);
                return (
                  <li key={s.schluessel}>
                    <button type="button" className={styles.zeilenKnopf} onClick={() => wahl(s)}>
                      <DatumKachel tag={k.tag} monat={k.monat} gedimmt />
                      <FruehereText s={s} zeitzone={zeitzone} hinweis />
                      <Icon name="chev-right" size={18} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className={styles.leer}>
              In {monatTitel(`${monat}-01`)} gibt es nichts nachzutragen – kein Treffen ohne
              Protokoll.
            </div>
          ))}
        {stand.art === 'fertig' && stand.daten.treffenNichtFreigegeben && (
          <p className={styles.hinweis}>
            Die Gruppentreffen sind für dich in ChurchTools nicht freigegeben – hier stehen nur
            Termine aus dem Kalender.
          </p>
        )}
      </div>
    </Sheet>
  );
}
