import { useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { Segment } from '@ui/bedienung/Segment';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import type { Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { kachel, monatTitel, tagKurz } from '@shared/ct/datum';
import {
  WEITERE,
  filtere,
  nachMonat,
  veranstaltungsArten,
  type Auswahl,
  type TerminZeile,
} from '@shared/dienstplan/termine';
import type { Plan } from '@shared/dienstplan/plan';
import { leseAuswahl, merkeAuswahl } from './auswahl';
import { Plakette } from './Plakette';
import styles from './Termine.module.scss';

export type TermineZustand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | { art: 'fertig'; zeilen: TerminZeile[]; plan: Plan; wochen: number };

interface Props {
  zustand: TermineZustand;
  /** Plant die Person etwas? Dann zeigen die Zeilen die freien Plätze ihrer Dienstgruppen. */
  planer: boolean;
  onNochmal: () => void;
  /** Die nächsten Wochen dazuladen. */
  onMehr: () => void;
}

/**
 * **Termine** (Bauplan E3-2, Entwurf v17): eine Liste nach Monaten, „Meine | Alle“ (Vorgabe Meine),
 * Filter nach Veranstaltung, Plaketten mit den eigenen Diensten; Planer sehen „N frei“ ihrer
 * Dienstgruppen. Nur lesen – Öffnen eines Termins kommt später.
 */
export function Termine({ zustand, planer, onNochmal, onMehr }: Props) {
  const [auswahl, setAuswahl] = useState<Auswahl>(leseAuswahl);
  const aendern = (a: Auswahl) => {
    setAuswahl(a);
    merkeAuswahl(a);
  };

  const alle = zustand.art === 'fertig' ? zustand.zeilen : [];
  const arten = veranstaltungsArten(alle);
  const monate = nachMonat(filtere(alle, auswahl));
  const umschalten = (art: string) =>
    aendern({
      ...auswahl,
      ausgeblendet: auswahl.ausgeblendet.includes(art)
        ? auswahl.ausgeblendet.filter((a) => a !== art)
        : [...auswahl.ausgeblendet, art],
    });

  return (
    <div>
      <section className={styles.karte} aria-labelledby="termine-titel">
        <div className={styles.kopf}>
          <h2 id="termine-titel">Termine</h2>
          <Segment
            value={auswahl.nurMeine ? 'meine' : 'alle'}
            options={[
              { value: 'meine', label: 'Meine' },
              { value: 'alle', label: 'Alle' },
            ]}
            onChange={(v) => aendern({ ...auswahl, nurMeine: v === 'meine' })}
            ariaLabel="Welche Termine"
          />
          {arten.length > 1 && (
            <div className={styles.chips} role="group" aria-label="Veranstaltungen">
              {arten.map((art) => (
                <button
                  key={art || 'weitere'}
                  type="button"
                  className={styles.chip}
                  aria-pressed={!auswahl.ausgeblendet.includes(art)}
                  onClick={() => umschalten(art)}
                >
                  {art === WEITERE ? 'Weitere' : art}
                </button>
              ))}
            </div>
          )}
        </div>

        {zustand.art === 'laedt' && <p className={styles.hinweis}>Termine werden geladen …</p>}

        {zustand.art === 'fehler' && (
          <div className={styles.hinweis}>
            <FehlerKasten fehler={zustand.fehler} onNochmal={onNochmal} />
          </div>
        )}

        {zustand.art === 'fertig' && monate.length === 0 && (
          <p className={styles.leer}>
            {auswahl.nurMeine
              ? `Du hast in den nächsten ${zustand.wochen} Wochen keine Dienste. Unter „Alle“ stehen alle Termine.`
              : 'Keine Termine für diese Auswahl.'}
          </p>
        )}

        {monate.map((m) => (
          <div key={m.monat}>
            <h3 className={styles.monat}>{monatTitel(`${m.monat}-01`)}</h3>
            <ul className={styles.liste}>
              {m.zeilen.map((z) => (
                <TerminReihe key={z.id} z={z} planer={planer} />
              ))}
            </ul>
          </div>
        ))}

        {zustand.art === 'fertig' && (
          <div className={styles.mehr}>
            <button type="button" className={styles.knopf} onClick={onMehr}>
              Weitere Termine laden
            </button>
          </div>
        )}
      </section>
      <p className={styles.fussnote}>
        Welche Termine du unter „Alle“ siehst, entscheidet ChurchTools (Kalender-Rechte). Termine,
        in denen du eingeteilt bist, siehst du immer.
      </p>
    </div>
  );
}

function TerminReihe({ z, planer }: { z: TerminZeile; planer: boolean }) {
  const k = kachel(z.tag);
  return (
    <li className={styles.zeile}>
      <DatumKachel tag={k.tag} monat={k.monat} />
      <div className={styles.mitte}>
        <b>{z.name}</b>
        <small>
          {tagKurz(z.tag)} · {z.uhrzeit} Uhr
        </small>
        {(z.meine.length > 0 || z.abgesagt) && (
          <span className={styles.tags}>
            {z.abgesagt && <Plakette art="abgesagt">abgesagt</Plakette>}
            {z.meine.map((d, i) => (
              <Plakette key={i} art={d.zugesagt ? 'zugesagt' : 'angefragt'}>
                {d.zugesagt ? d.dienst : `${d.dienst} · angefragt`}
              </Plakette>
            ))}
          </span>
        )}
      </div>
      {planer &&
        !z.abgesagt &&
        z.geplant > 0 &&
        (z.frei > 0 ? (
          <span className={styles.frei}>{z.frei} frei</span>
        ) : (
          <span className={styles.besetzt} aria-label="alles besetzt" title="alles besetzt">
            <Icon name="check" size={16} />
          </span>
        ))}
    </li>
  );
}
