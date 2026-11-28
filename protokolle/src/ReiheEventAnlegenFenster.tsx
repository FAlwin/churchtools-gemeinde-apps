import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import { Etikett } from '@ui/bedienung/Etikett';
import { useLaden } from '@ui/ct/useLaden';
import { tagPunkt } from '@shared/ct/datum';
import { gemeindeZeitzone } from '@shared/ct/zeit';
import {
  EVENT_BEGINN,
  EVENT_ENDE,
  eventAnlegenFehler,
  type TagErgebnis,
} from '@shared/protokolle/reiheEventAnlegen';
import type { ReiheZeile } from '@shared/protokolle/themenreihe';
import { ladeEventVorlagen } from './eventsLesen';
import { ladeSchreibKalender } from './kalenderListe';
import { reiheEventsAnlegen } from './reiheEventAnlegen';
import felder from './Fensterfelder.module.scss';
import styles from './ReiheEventAnlegenFenster.module.scss';

/**
 * **Fenster „Event anlegen“** (Baustein „Reihe“, Scheibe 3; Entwurf `reihe-event-anlegen-s3-v1`): oben die Abende als Etiketten
 * („Für“), dann **Kalender** (nur die, in denen die Person Termine **und** Events anlegen darf – `kalender`), **Titel**
 * (vorbelegt mit dem Namen der Reihe), **Beginn/Ende** und die **Eventvorlage** (Pflicht; die Nummer 0 „Standard“ ist
 * gültig). Kalender und Vorlagen werden erst gelesen, wenn das Fenster aufgeht. „Anlegen“ legt die Events **nacheinander**
 * an (`reiheEventsAnlegen`); danach schließt das Fenster und `onFertig` bekommt, was an jedem Abend herauskam – gesagt wird es
 * im Fenster „Reihe“ in EINER Zusammenfassung. Die Event-Nummern landen nur im Zustand des Fensters „Reihe“ – gespeichert
 * wird dort.
 */
export function ReiheEventAnlegenFenster({
  abende,
  reiheName,
  kalender: erlaubt,
  onFertig,
  onClose,
}: {
  /** Die Abende, für die Events entstehen sollen (mindestens einer, mit gültigem Datum, ohne Event). */
  abende: readonly ReiheZeile[];
  reiheName: string;
  /** Kalender mit „Termine anlegen“ **und** „Events anlegen“ – stabil halten (lädt neu, sobald sich die Liste ändert). */
  kalender: readonly number[];
  onFertig: (ergebnisse: TagErgebnis[]) => void;
  onClose: () => void;
}) {
  const zeitzone = gemeindeZeitzone();
  const kalenderListe = useLaden(() => ladeSchreibKalender(erlaubt), [erlaubt]);
  const vorlagenListe = useLaden(() => ladeEventVorlagen(), []);
  const [kalenderWahl, setKalenderWahl] = useState<number | null>(null);
  const [titel, setTitel] = useState(reiheName.trim());
  const [von, setVon] = useState(EVENT_BEGINN);
  const [bis, setBis] = useState(EVENT_ENDE);
  // Als Text, damit „0“ („Standard“) von „nichts gewählt“ (`''`) zu unterscheiden ist.
  const [vorlage, setVorlage] = useState('');
  const [nr, setNr] = useState<number | null>(null);

  const kalender = kalenderListe.stand.art === 'fertig' ? kalenderListe.stand.daten : [];
  const kalenderId = kalenderWahl ?? kalender[0]?.id ?? null;
  const vorlagen = vorlagenListe.stand.art === 'fertig' ? vorlagenListe.stand.daten : [];
  const eingabe = {
    kalender: kalenderId,
    titel,
    von,
    bis,
    vorlage: vorlage === '' ? null : Number(vorlage),
  };
  const laeuft = nr !== null;
  const fehlt = eventAnlegenFehler(eingabe, abende[0].datum);
  const mehrere = abende.length > 1;

  async function anlegen(): Promise<void> {
    const k = kalender.find((x) => x.id === kalenderId);
    if (fehlt || !k) return;
    setNr(1);
    const ergebnisse = await reiheEventsAnlegen({
      abende: abende.map((z) => ({ id: z.id, tag: z.datum })),
      eingabe: { ...eingabe, kalender: k.id },
      kalenderName: k.name,
      zeitzone,
      onAbend: setNr,
    });
    onFertig(ergebnisse);
  }

  const laden = kalenderListe.stand.art === 'laedt' || vorlagenListe.stand.art === 'laedt';
  const ladeFehler =
    kalenderListe.stand.art === 'fehler'
      ? kalenderListe.stand
      : vorlagenListe.stand.art === 'fehler'
        ? vorlagenListe.stand
        : null;
  return (
    <Sheet
      title={mehrere ? `Events für ${abende.length} Abende anlegen` : 'Event anlegen'}
      onClose={onClose}
      mittel
      beschaeftigt={laeuft}
      knoepfe={
        <FensterKnopf disabled={laeuft || laden || !!fehlt} onClick={() => void anlegen()}>
          {laeuft
            ? mehrere
              ? `Legt an … ${nr} von ${abende.length}`
              : 'Legt an …'
            : mehrere
              ? `${abende.length} Events anlegen`
              : 'Anlegen'}
        </FensterKnopf>
      }
    >
      <div className={felder.feld}>
        <span>Für</span>
        <div className={styles.daten}>
          {abende.map((z) => (
            <Etikett key={z.id}>{tagPunkt(z.datum)}</Etikett>
          ))}
        </div>
      </div>
      {ladeFehler && (
        <p className={felder.fehler} role="alert">
          {ladeFehler.fehler.text}{' '}
          {ladeFehler.fehler.nochmal && (
            <TextKnopf
              onClick={() => {
                kalenderListe.neu();
                vorlagenListe.neu();
              }}
            >
              Erneut versuchen
            </TextKnopf>
          )}
        </p>
      )}
      <label className={felder.feld}>
        <span>Kalender</span>
        <select
          className={felder.eingabe}
          value={kalenderId ?? ''}
          disabled={laeuft || laden}
          onChange={(e) => setKalenderWahl(Number(e.target.value))}
        >
          {kalender.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </label>
      <label className={felder.feld}>
        <span>Titel</span>
        <input
          className={felder.eingabe}
          value={titel}
          maxLength={120}
          disabled={laeuft}
          onChange={(e) => setTitel(e.target.value)}
        />
      </label>
      <div className={felder.zeile}>
        <label className={felder.feld}>
          <span>Beginn</span>
          <input
            type="time"
            className={felder.eingabe}
            value={von}
            disabled={laeuft}
            onChange={(e) => setVon(e.target.value)}
          />
        </label>
        <label className={felder.feld}>
          <span>Ende</span>
          <input
            type="time"
            className={felder.eingabe}
            value={bis}
            disabled={laeuft}
            onChange={(e) => setBis(e.target.value)}
          />
        </label>
      </div>
      <label className={felder.feld}>
        <span>Eventvorlage</span>
        <select
          className={felder.eingabe}
          value={vorlage}
          disabled={laeuft || laden}
          onChange={(e) => setVorlage(e.target.value)}
        >
          <option value="">{laden ? 'wird geladen …' : ''}</option>
          {vorlagen.map((v) => (
            <option key={v.id} value={String(v.id)}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <p className={felder.leise}>
        Aus der Vorlage kommen Dienste und Ablauf. Es geht keine Einladung raus.
      </p>
      {fehlt && !laden && !ladeFehler && <p className={felder.leise}>{fehlt}</p>}
    </Sheet>
  );
}
