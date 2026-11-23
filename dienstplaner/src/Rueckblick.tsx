import { useMemo, useState } from 'react';
import { Etikett } from '@ui/bedienung/Etikett';
import { MehrMenue } from '@ui/bedienung/MehrMenue';
import { HANDY_BREITE, useMedienAbfrage } from '@ui/bedienung/useMedienAbfrage';
import { Icon } from '@ui/icons/icons';
import type { Option } from '@ui/bedienung/OptionWaehlen';
import { tagMonat } from '@shared/ct/datum';
import { kontoText, liveListe, restText } from '@shared/ct/liveAgenda';
import { ausnahmeSetzen, type Ausnahme } from '@shared/ct/liveVerlauf';
import {
  rueckblickAus,
  schnittSchluessel,
  type RueckblickZeile,
  type Schnitt,
  type VerlaufTermin,
} from '@shared/ct/liveRueckblick';
import { VERLAUF_VERWEIGERT } from '@shared/dienstplan/liveVerlaufSpeicher';
import type { CtAgendaItem } from '@shared/ct/typen';
import { ortszeitAus } from '@shared/ct/zeit';
import type { MeineAnzeige } from './meineAnzeige';
import { schreibeAusnahmen } from './ladeVerlauf';
import styles from './Rueckblick.module.scss';

const NICHT_GESPEICHERT = 'Die Markierung ließ sich nicht speichern. Bitte noch einmal versuchen.';

/** „10:02“ – Uhrzeit eines Zeitpunkts in der Zeitzone der Gemeinde. */
const uhrzeit = (ms: number, zeitzone: string) =>
  ortszeitAus(new Date(ms).toISOString(), zeitzone).slice(11, 16);

/** ± mit Farbe: Plus (gespart/früher) grün, Minus (überzogen/später) rot, genau im Plan neutral. */
function PlusMinus({ sek }: { sek: number | null }) {
  if (sek === null) return <span className={styles.leise}>–</span>;
  return (
    <span className={sek > 0 ? styles.plus : sek < 0 ? styles.minus : undefined}>
      {kontoText(sek)}
    </span>
  );
}

/**
 * **Der Rückblick** (Live-Ansicht 2, L4-4, Entwurf `live-2.html` Abschnitt 6, A6/A18): im Termin unter dem Ablauf, sobald
 * Live zu Ende ist – Beginn und Ende gegen den Plan, am meisten eingeholt und überzogen, dazu je Punkt Plan / Gelaufen / ± /
 * „Ø bisher“. Alles rechnet `rueckblickAus` (`shared/ct/liveRueckblick.ts`); hier wird nur gezeigt. Ohne Verlauf oder ohne
 * Ende des Live gibt es keine Karte.
 *
 * **Aus dem Schnitt nehmen** (A9, nur wer planen darf, `darfAusnehmen`): über „⋯“ je Zeile ein Punkt, im Kartenkopf der
 * ganze Termin – wenn jemand das Weiterklicken vergessen hat. Die Markierung wird zusammengeführt festgehalten
 * (`schreibeAusnahmen`); die Zeile bleibt stehen, trägt das Etikett „nicht im Schnitt“ und zählt nicht für „Ø bisher“ und
 * die größten Abweichungen.
 */
export function Rueckblick({
  terminId,
  tag,
  items,
  zeitzone,
  verlauf,
  schnitt,
  darfAusnehmen,
  anzeige,
  onAusnahmen,
  schreiben = schreibeAusnahmen,
}: {
  terminId: number;
  tag: string;
  items: readonly CtAgendaItem[];
  zeitzone: string;
  verlauf: VerlaufTermin;
  /** Der Schnitt aus allen Terminen; `null`, solange er nicht gelesen ist. */
  schnitt: Schnitt | null;
  /** Darf man Punkte und Termine aus dem Schnitt nehmen? (Wer planen darf; ohne: kein „⋯“.) */
  darfAusnehmen: boolean;
  anzeige: Pick<MeineAnzeige, 'rueckblick' | 'spalteSchnitt' | 'spalteAbweichung'>;
  /** Die Markierungen dieses Termins haben sich geändert (nachgelesen) – der Aufrufer hält sie. */
  onAusnahmen: (ausnahmen: Ausnahme[]) => void;
  schreiben?: typeof schreibeAusnahmen;
}) {
  const handy = useMedienAbfrage(HANDY_BREITE);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const rb = useMemo(
    () => rueckblickAus(liveListe(items, terminId), verlauf),
    [items, terminId, verlauf],
  );
  // Die Punkte in den Abschnitten des Ablaufs – ein Band je Überschrift, die Punkte hat.
  const abschnitte = useMemo(() => {
    const aus: { titel: string | null; zeilen: RueckblickZeile[] }[] = [
      { titel: null, zeilen: [] },
    ];
    const nachId = new Map((rb?.zeilen ?? []).map((z) => [z.punkt.id, z]));
    for (const i of items) {
      if (i.type === 'header') aus.push({ titel: i.title, zeilen: [] });
      else {
        const z = nachId.get(i.id);
        if (z) aus[aus.length - 1].zeilen.push(z);
      }
    }
    return aus.filter((a) => a.zeilen.length > 0);
  }, [items, rb]);

  if (!rb || !anzeige.rueckblick) return null;

  async function setzen(punkt: number | null, aus: boolean): Promise<void> {
    if (laeuft) return;
    setLaeuft(true);
    setFehler(null);
    const neu = ausnahmeSetzen(verlauf.ausnahmen, punkt, aus, Date.now()).find(
      (a) => a.punkt === punkt,
    );
    try {
      const r = neu ? await schreiben(terminId, [neu]) : null;
      if (r?.ok) onAusnahmen(r.ausnahmen);
      else setFehler(r?.grund === 'kein-recht' ? VERLAUF_VERWEIGERT : NICHT_GESPEICHERT);
    } catch {
      setFehler(NICHT_GESPEICHERT);
    } finally {
      setLaeuft(false);
    }
  }

  const schnittWert = (z: RueckblickZeile) => {
    const k = schnittSchluessel(z.punkt.title, z.punkt.lied === true);
    const w = k === null ? undefined : schnitt?.get(k);
    return w ? { ...w, lied: z.punkt.lied === true } : null;
  };
  const kopfMenue: Option[] = darfAusnehmen
    ? [
        {
          label: rb.terminAusgenommen
            ? 'Termin wieder in den Schnitt nehmen'
            : 'Termin aus dem Schnitt nehmen',
          symbol: <Icon name={rb.terminAusgenommen ? 'eye' : 'eye-off'} size={16} />,
          gesperrt: laeuft,
          onClick: () => void setzen(null, !rb.terminAusgenommen),
        },
      ]
    : [];
  const zeile = (z: RueckblickZeile) => {
    const s = schnittWert(z);
    const menue: Option[] = darfAusnehmen
      ? [
          {
            label: z.ausgenommen ? 'Wieder in den Schnitt nehmen' : 'Aus dem Schnitt nehmen',
            symbol: <Icon name={z.ausgenommen ? 'eye' : 'eye-off'} size={16} />,
            gesperrt: laeuft,
            onClick: () => void setzen(z.punkt.id, !z.ausgenommen),
          },
        ]
      : [];
    return (
      <div
        key={z.punkt.id}
        role="row"
        className={`${styles.zeile}${z.ausgenommen ? ` ${styles.raus}` : ''}`}
      >
        <span role="cell" className={styles.titel}>
          <span className={styles.name}>{z.punkt.title}</span>
          {z.ausgenommen && (
            <Etikett title="Dieser Punkt zählt nicht für „Ø bisher“.">nicht im Schnitt</Etikett>
          )}
        </span>
        <span role="presentation" className={styles.meta}>
          <span role="cell" className={`${styles.zahl} ${styles.plan}`}>
            <span className={styles.beschriftung}>Plan </span>
            {z.planSek === null ? '–' : restText(z.planSek)}
          </span>
          <span role="cell" className={`${styles.zahl} ${styles.gelaufen}`}>
            <span className={styles.beschriftung}>Gelaufen </span>
            {restText(z.gelaufenSek)}
          </span>
          {anzeige.spalteSchnitt && (
            <span role="cell" className={`${styles.zahl} ${styles.schnitt}`}>
              {!s?.lied && <span className={styles.beschriftung}>Ø bisher </span>}
              {s ? `${s.lied ? 'Lied Ø ' : ''}${restText(s.sek)} · ${s.n}×` : '–'}
            </span>
          )}
        </span>
        {anzeige.spalteAbweichung && (
          <span role="cell" className={`${styles.zahl} ${styles.pm}`}>
            <PlusMinus sek={z.abweichungSek} />
          </span>
        )}
        <span role="cell" className={styles.menue}>
          <MehrMenue optionen={menue} handy={handy} titel={`Mehr – ${z.punkt.title}`} />
        </span>
      </div>
    );
  };

  const klassen = [
    styles.tabelle,
    anzeige.spalteAbweichung ? '' : styles.ohnePm,
    anzeige.spalteSchnitt ? '' : styles.ohneSchnitt,
  ].join(' ');

  return (
    <section className={styles.karte} aria-label="Rückblick">
      <div className={styles.kopf}>
        <h3>
          Rückblick · Live am {tagMonat(tag)}
          {rb.terminAusgenommen && (
            <Etikett title="Dieser Termin zählt nicht für „Ø bisher“.">nicht im Schnitt</Etikett>
          )}
        </h3>
        <MehrMenue optionen={kopfMenue} handy={handy} titel="Mehr – Rückblick" />
      </div>
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}
      <div className={styles.chips}>
        {rb.beginn && (
          <div className={styles.chip}>
            Beginn
            <b>
              {uhrzeit(rb.beginn.zeit, zeitzone)} <PlusMinus sek={rb.beginn.abweichungSek} />
            </b>
          </div>
        )}
        <div className={styles.chip}>
          Ende
          <b>
            {uhrzeit(rb.ende.zeit, zeitzone)} <PlusMinus sek={rb.ende.abweichungSek} />
          </b>
        </div>
        {rb.eingeholt && (
          <div className={styles.chip}>
            Am meisten eingeholt
            <b>
              {rb.eingeholt.punkt.title} <PlusMinus sek={rb.eingeholt.sek} />
            </b>
          </div>
        )}
        {rb.ueberzogen && (
          <div className={styles.chip}>
            Am meisten überzogen
            <b>
              {rb.ueberzogen.punkt.title} <PlusMinus sek={rb.ueberzogen.sek} />
            </b>
          </div>
        )}
      </div>
      <div role="table" aria-label="Was wie lange lief" className={klassen}>
        <div role="row" className={`${styles.zeile} ${styles.tabellenKopf}`}>
          <span role="columnheader" className={styles.titel}>
            Punkt
          </span>
          <span role="presentation" className={styles.meta}>
            <span role="columnheader" className={`${styles.zahl} ${styles.plan}`}>
              Plan
            </span>
            <span role="columnheader" className={`${styles.zahl} ${styles.gelaufen}`}>
              Gelaufen
            </span>
            {anzeige.spalteSchnitt && (
              <span role="columnheader" className={`${styles.zahl} ${styles.schnitt}`}>
                Ø bisher
              </span>
            )}
          </span>
          {anzeige.spalteAbweichung && (
            <span role="columnheader" className={`${styles.zahl} ${styles.pm}`}>
              ±
            </span>
          )}
          <span role="columnheader" className={styles.menue} />
        </div>
        {abschnitte.map((a, i) => (
          <div key={`${a.titel ?? ''}-${i}`} role="rowgroup">
            {a.titel !== null && <div className={styles.band}>{a.titel}</div>}
            {a.zeilen.map(zeile)}
          </div>
        ))}
      </div>
      <p className={styles.unterschrift}>
        „Ø bisher“ zählt gleichnamige Punkte aller Termine mit Rückblick; alle Lieder zählen
        zusammen als „Lied“.
      </p>
    </section>
  );
}
