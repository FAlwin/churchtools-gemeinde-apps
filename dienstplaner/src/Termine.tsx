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
import { plaketteArt } from './plaketteArt';
import { AntwortKnoepfe } from './AntwortKnoepfe';
import { Toast } from '@ui/fenster/Toast';
import type { Antworten } from './useAntworten';
import type { Tausch } from './useTausch';
import { TauschAmDienst } from './TauschTeile';
import { FilterKnopf } from '@ui/bedienung/FilterKnopf';
import styles from './Termine.module.scss';
import { gemeindeZeitzone } from '@shared/ct/zeit';

export type TermineZustand =
  | { art: 'laedt' }
  | { art: 'fehler'; fehler: Fehlermeldung }
  | {
      art: 'fertig';
      zeilen: TerminZeile[];
      plan: Plan;
      wochen: number;
      /** Weitere Wochen nachzuladen ging schief – das Bisherige bleibt stehen (vorübergehend ≠ ungültig). */
      nachladeFehler?: Fehlermeldung;
    };

interface Props {
  zustand: TermineZustand;
  /** Plant die Person etwas? Dann zeigen die Zeilen die freien Plätze ihrer Dienstgruppen. */
  planer: boolean;
  onNochmal: () => void;
  /** Die nächsten Wochen dazuladen. */
  onMehr: () => void;
  /** Eine Zeile antippen → Termin-Ansicht (E6-1b). */
  onTermin?: (id: number) => void;
  /** Anfragen beantworten (E7-1) – ohne: nur ansehen. */
  antworten?: Antworten;
  /** Dienste tauschen (E7-3) – ohne: kein „Tauschen“. */
  tausch?: Tausch;
  zeitzone?: string;
}

/**
 * **Termine** (Bauplan E3-2, Entwurf v17): eine Liste nach Monaten, „Meine | Alle“ (Vorgabe Meine),
 * Filter nach Veranstaltung, Plaketten mit den eigenen Diensten; Planer sehen „N frei“ ihrer
 * Dienstgruppen. Eine Zeile öffnet die Termin-Ansicht (E6-1b); offene Anfragen lassen sich darunter zusagen oder absagen
 * (E7-1, `AntwortKnoepfe`).
 */
export function Termine({
  zustand,
  planer,
  onNochmal,
  onMehr,
  onTermin,
  antworten,
  tausch,
  zeitzone = gemeindeZeitzone(),
}: Props) {
  // Weitere Wochen laden im Hintergrund (das Bisherige bleibt stehen) – bis die Antwort da ist, sagt der
  // Knopf es. „Läuft“, solange noch der Stand vom Klick dasteht: Mit der Antwort (oder dem Fehler) ist es schon in
  // diesem Bild vorbei. Vorher räumte ein Effekt das ein Bild zu spät weg – dann stand „wird geladen …“ neben
  // „Erneut versuchen“ (wie in Planen, `laedtNach`).
  const [geklicktBei, setGeklicktBei] = useState<Props['zustand'] | null>(null);
  const laeuft = geklicktBei !== null && geklicktBei === zustand;
  const mehr = () => {
    setGeklicktBei(zustand);
    onMehr();
  };
  const [auswahl, setAuswahl] = useState<Auswahl>(leseAuswahl);
  const aendern = (a: Auswahl) => {
    setAuswahl(a);
    merkeAuswahl(a);
  };

  const alle = zustand.art === 'fertig' ? zustand.zeilen : [];
  const arten = veranstaltungsArten(alle);
  const monate = nachMonat(filtere(alle, auswahl));

  return (
    <div>
      <section className={styles.karte} aria-labelledby="termine-titel">
        <div className={styles.kopf}>
          <h2 id="termine-titel">Dienste</h2>
          <Segment
            value={auswahl.nurMeine ? 'meine' : 'alle'}
            options={[
              { value: 'meine', label: 'Meine' },
              { value: 'alle', label: 'Alle' },
            ]}
            onChange={(v) => aendern({ ...auswahl, nurMeine: v === 'meine' })}
            ariaLabel="Welche Termine"
            verbunden
          />
          <FilterKnopf
            className={styles.filterRechts}
            abschnitte={[
              {
                titel: 'Veranstaltungen',
                optionen: arten.map((art) => ({
                  wert: art,
                  text: art === WEITERE ? 'Weitere' : art,
                })),
                aus: auswahl.ausgeblendet,
                onAus: (ausgeblendet) => aendern({ ...auswahl, ausgeblendet }),
              },
            ]}
          />
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
                <TerminReihe
                  key={z.id}
                  z={z}
                  planer={planer}
                  onTermin={onTermin}
                  antworten={antworten}
                  tausch={tausch}
                  zeitzone={zeitzone}
                />
              ))}
            </ul>
          </div>
        ))}

        {zustand.art === 'fertig' && zustand.nachladeFehler && (
          <div className={styles.hinweis}>
            <FehlerKasten fehler={zustand.nachladeFehler} onNochmal={mehr} />
          </div>
        )}
        {zustand.art === 'fertig' && (
          <div className={styles.mehr}>
            <button type="button" className={styles.knopf} onClick={mehr} disabled={laeuft}>
              {laeuft ? 'wird geladen …' : 'Weitere Termine laden'}
            </button>
          </div>
        )}
      </section>
      <Toast message={antworten?.meldung ?? tausch?.meldung ?? null} />
      <p className={styles.fussnote}>
        Welche Termine du unter „Alle“ siehst, entscheidet ChurchTools (Kalender-Rechte). Termine,
        in denen du eingeteilt bist, siehst du immer.
      </p>
    </div>
  );
}

function TerminReihe({
  z,
  planer,
  onTermin,
  antworten,
  tausch,
  zeitzone,
}: {
  z: TerminZeile;
  planer: boolean;
  onTermin?: (id: number) => void;
  antworten?: Antworten;
  tausch?: Tausch;
  zeitzone: string;
}) {
  const k = kachel(z.tag);
  const inhalt = (
    <>
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
              <Plakette key={i} art={plaketteArt(d)}>
                {d.zugesagt ? d.dienst : `${d.dienst} · ${plaketteArt(d)}`}
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
    </>
  );
  // Offene oder eben beantwortete Anfragen: Zusagen/Absagen unter der Zeile (E7-1) – nicht im Knopf der Zeile, ein Knopf
  // in einem Knopf geht nicht.
  // Tauschen (E7-3) an jedem eigenen Dienst – zugesagt oder offen, nicht nach einer eben gegebenen Absage.
  const offen = antworten ? z.meine.filter((d) => d.ort && (!d.zugesagt || d.antwort)) : [];
  const tauschbar = tausch ? z.meine.filter((d) => d.ort && d.antwort?.art !== 'abgesagt') : [];
  const knoepfe = (offen.length > 0 || tauschbar.length > 0) && (
    <div className={styles.antworten}>
      {antworten &&
        offen.map((d, i) => (
          <AntwortKnoepfe key={i} termin={z} d={d} antworten={antworten} mitDienst />
        ))}
      {tausch &&
        tauschbar.map((d, i) => (
          <TauschAmDienst
            key={`t${i}`}
            d={{ terminId: z.id, termin: z.name, tag: z.tag, dienst: d.dienst, ort: d.ort! }}
            tausch={tausch}
            zeitzone={zeitzone}
          />
        ))}
    </div>
  );
  // Antippen öffnet die Termin-Ansicht mit Ablauf und Diensten (E6-1b).
  if (!onTermin) {
    return (
      <li className={styles.zeileLi}>
        <div className={styles.zeile}>{inhalt}</div>
        {knoepfe}
      </li>
    );
  }
  return (
    <li className={styles.zeileLi}>
      <button
        type="button"
        className={`${styles.zeile} ${styles.zeileKnopf}`}
        onClick={() => onTermin(z.id)}
      >
        {inhalt}
        <span className={styles.pfeil} aria-hidden>
          <Icon name="chev-right" size={16} />
        </span>
      </button>
      {knoepfe}
    </li>
  );
}
