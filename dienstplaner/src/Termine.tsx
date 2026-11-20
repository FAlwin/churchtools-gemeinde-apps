import { lazy, Suspense, useState } from 'react';
import { Icon } from '@ui/icons/icons';
import { AnsichtWahl } from '@ui/bedienung/AnsichtWahl';
import { Werkzeugzeile } from '@ui/bedienung/Werkzeugzeile';
import { MehrMenue } from '@ui/bedienung/MehrMenue';
import { TextKnopf } from '@ui/bedienung/TextKnopf';
import type { Option } from '@ui/bedienung/OptionWaehlen';
import { DatumKachel } from '@ui/bedienung/DatumKachel';
import { FehlerKasten } from '@ui/erweiterung/ErweiterungsSeite';
import type { Fehlermeldung } from '@ui/ct/fehlerMeldung';
import { kachel, monatTitel, tagKurz } from '@shared/ct/datum';
import {
  filtere,
  nachMonat,
  terminFilter,
  type Auswahl,
  type TerminZeile,
} from '@shared/dienstplan/termine';
import type { Plan } from '@shared/dienstplan/plan';
import { leseAuswahl, merkeAuswahl } from './auswahl';
import { terminAbschnitte } from './terminAbschnitte';
import { Plakette } from './Plakette';
import { plaketteArt } from './plaketteArt';
import { AntwortKnoepfe } from './AntwortKnoepfe';
import { Toast } from '@ui/fenster/Toast';
import type { Antworten } from './useAntworten';
import type { Tausch } from './useTausch';
import { TauschAmDienst } from './TauschTeile';
import { FilterKnopf } from '@ui/bedienung/FilterKnopf';
import { HilfeFenster } from '@ui/bedienung/HilfeKnopf';
import { HILFE_DIENSTE } from './hilfeTexte';
import styles from './Termine.module.scss';
import { gemeindeZeitzone } from '@shared/ct/zeit';

/** „Meine Dienste teilen“ (E8-3) erst beim Antippen laden – es bringt pdf.js mit (wie die anderen Teilen-Fenster). */
const MeineTeilenFenster = lazy(() =>
  import('./MeineTeilenFenster').then((m) => ({ default: m.MeineTeilenFenster })),
);

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
  /** Wer man ist – für „Meine Dienste teilen“ (E8-3); ohne: kein „Teilen“. */
  ich?: { id: number; name: string; gemeinde: string | null };
  /** Handy-Breite? Dann zweizeilige Werkzeugzeile mit Rahmen um jedes Werkzeug (R12) und die Ansichtswahl als Knopf. */
  handy?: boolean;
}

/**
 * **Termine** (Bauplan E3-2, Entwurf v17): eine Liste nach Monaten, „Meine | Alle“ (Vorgabe Meine),
 * Filter nach Kalender und Veranstaltung (`terminFilter`), Plaketten mit den eigenen Diensten; Planer sehen „N frei“ ihrer
 * Dienstgruppen. Eine Zeile öffnet die Termin-Ansicht (E6-1b); offene Anfragen lassen sich darunter zusagen oder absagen
 * (E7-1, `AntwortKnoepfe`).
 *
 * **Seit „Ruhige Bedienung“ B4 (20.11.2026, Entwurf „Restliche Bildschirme“ Abschnitt 3):** Die Werkzeugzeile (R5) steht über
 * der Karte statt darin – links „Meine | Alle“, rechts „Filter“ (still) und das „⋯“-Menü mit „Teilen“ (nur bei „Meine“) und
 * „Hilfe“. „Weitere Wochen laden“ ist ein stilles blaues Wort unter der Karte; eine leere Liste führt mit einem Link zu „Alle“.
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
  ich,
  handy = false,
}: Props) {
  const [teilenOffen, setTeilenOffen] = useState(false);
  // „Hilfe“ liegt im „⋯“-Menü (R6) – das Fenster gehört der Seite, nicht dem Menü.
  const [hilfeOffen, setHilfeOffen] = useState(false);
  // Weitere Wochen laden im Hintergrund (das Bisherige bleibt stehen) – bis die Antwort da ist, sagt der
  // Knopf es. „Läuft“, solange noch der Stand vom Klick dasteht: Mit der Antwort (oder dem Fehler) ist es schon in
  // diesem Bild vorbei. Vorher räumte ein Effekt das ein Bild zu spät weg – dann stand „wird geladen …“ neben
  // „Erneut versuchen“ (wie in Planen, `laedtNach`).
  const [geklicktBei, setGeklicktBei] = useState<Props['zustand'] | null>(null);
  const laeuft = geklicktBei !== null && geklicktBei === zustand;
  const mehrLaden = () => {
    setGeklicktBei(zustand);
    onMehr();
  };
  const [auswahl, setAuswahl] = useState<Auswahl>(leseAuswahl);
  const aendern = (a: Auswahl) => {
    setAuswahl(a);
    merkeAuswahl(a);
  };

  const alle = zustand.art === 'fertig' ? zustand.zeilen : [];
  const aus = { kalender: auswahl.ausgeblendeteKalender, arten: auswahl.ausgeblendet };
  const angebot = terminFilter(alle, aus);
  const monate = nachMonat(filtere(alle, auswahl));

  // Das „⋯“-Menü (R6): „Teilen“ nur bei „Meine“ (Entwurf E8: alle kommenden eigenen Dienste als PDF), „Hilfe“ immer.
  const teilenMoeglich = !!ich && auswahl.nurMeine;
  const mehr: Option[] = [
    ...(teilenMoeglich
      ? [
          {
            label: 'Teilen',
            symbol: <Icon name="share" size={16} />,
            onClick: () => setTeilenOffen(true),
          },
        ]
      : []),
    {
      label: 'Hilfe',
      symbol: <Icon name="hilfe" size={16} />,
      onClick: () => setHilfeOffen(true),
      trenner: teilenMoeglich,
    },
  ];

  return (
    <div className={styles.seite}>
      <Werkzeugzeile
        handy={handy}
        links={
          <AnsichtWahl
            value={auswahl.nurMeine ? 'meine' : 'alle'}
            options={[
              { value: 'meine', label: 'Meine' },
              { value: 'alle', label: 'Alle' },
            ]}
            onChange={(v) => aendern({ ...auswahl, nurMeine: v === 'meine' })}
            ariaLabel="Welche Termine"
            handy={handy}
          />
        }
        rechts={
          <>
            <FilterKnopf
              still
              abschnitte={terminAbschnitte(angebot, aus, (a) =>
                aendern({ ...auswahl, ausgeblendeteKalender: a.kalender, ausgeblendet: a.arten }),
              )}
            />
            <MehrMenue optionen={mehr} handy={handy} />
          </>
        }
      />
      {hilfeOffen && (
        <HilfeFenster
          seite="Dienste"
          abschnitte={HILFE_DIENSTE}
          onClose={() => setHilfeOffen(false)}
        />
      )}
      <section className={styles.karte} aria-label="Dienste">
        {teilenOffen && ich && (
          <Suspense fallback={null}>
            <MeineTeilenFenster
              wer={{ ichId: ich.id, name: ich.name, gemeinde: ich.gemeinde, zeitzone }}
              onClose={() => setTeilenOffen(false)}
            />
          </Suspense>
        )}

        {zustand.art === 'laedt' && <p className={styles.hinweis}>Termine werden geladen …</p>}

        {zustand.art === 'fehler' && (
          <div className={styles.hinweis}>
            <FehlerKasten fehler={zustand.fehler} onNochmal={onNochmal} />
          </div>
        )}

        {zustand.art === 'fertig' && monate.length === 0 && (
          <div className={styles.leer}>
            {auswahl.nurMeine ? (
              <>
                <b>In den nächsten {zustand.wochen} Wochen hast du keine Dienste.</b>
                <TextKnopf onClick={() => aendern({ ...auswahl, nurMeine: false })}>
                  Alle Termine zeigen
                </TextKnopf>
              </>
            ) : (
              'Keine Termine für diese Auswahl.'
            )}
          </div>
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
            <FehlerKasten fehler={zustand.nachladeFehler} onNochmal={mehrLaden} />
          </div>
        )}
      </section>
      {zustand.art === 'fertig' && (
        <div className={styles.mehr}>
          <TextKnopf onClick={mehrLaden} disabled={laeuft}>
            {laeuft ? 'wird geladen …' : 'Weitere Wochen laden'}
          </TextKnopf>
        </div>
      )}
      <Toast message={antworten?.meldung ?? tausch?.meldung ?? null} />
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
