import { useState } from 'react';
import { Icon } from '../icons/icons';
import { Segment } from './Segment';
import { AuswahlBlatt, KnopfMitMenue } from './OptionWaehlen';
import { ReiterZaehler } from './ReiterZaehler';
import styles from './AnsichtWahl.module.scss';

/** Die Zeile einer Ansicht im Menü oder Blatt: die Zahl in Klammern („Einträge (3)“, „Anstehend (12)“). */
const blattText = (o: { label: string; zahl?: number; anzahl?: number }) =>
  o.zahl || o.anzahl ? `${o.label} (${o.zahl ?? o.anzahl})` : o.label;

/**
 * **Die Ansichtswahl der Werkzeugzeile** (R4/E9, „Ruhige Bedienung“ B3): am Rechner der Umschalter (`Segment`, verbunden –
 * der eine Kasten-Umschalter je Zeile), am Handy ein blau hinterlegter Knopf in Wortbreite mit Pfeil („Matrix ⌄“), der
 * beim Antippen die Ansichten als Blatt von unten aufklappt (`AuswahlBlatt`). Beides sieht aus wie der gewählte Umschalter
 * am Rechner – nur nimmt der Knopf am Handy so wenig Platz wie sein Wort.
 *
 * Eine Ansicht kann einen **Merker** tragen (`zahl`, B4/E24: „Einträge“ in „Wann kann ich?“): ein blau gefüllter Kreis direkt
 * hinter dem Wort, in derselben Zeile. Am Handy steht der Merker einer anderen Ansicht hinter dem Pfeil, damit man ihn
 * nicht erst im Blatt findet; im Blatt selbst steht die Zahl in Klammern.
 *
 * Eine Ansicht kann auch eine **Anzahl** tragen (`anzahl`, Anmelde-Tool B7: „Anstehend 12 | Entwürfe 2 | Vorbei 40“): grau und
 * leise hinter dem Wort – sie zählt, was in der Ansicht steht, und ist kein Merker. Im Menü und im Blatt in Klammern.
 *
 * **Viele Ansichten** (`alsKnopf`, Organigramm B5/E13: fünf sind zu viele für einen Kasten): auch am Rechner der Auswahlknopf –
 * dort klappt ein kleines Menü darunter auf (`KnopfMitMenue`, die gewählte Ansicht fett), am Handy wie sonst das Blatt.
 */
export function AnsichtWahl<T extends string>({
  value,
  options,
  onChange,
  handy,
  alsKnopf = false,
  ariaLabel = 'Ansicht',
}: {
  value: T;
  options: { value: T; label: string; zahl?: number; anzahl?: number }[];
  onChange: (v: T) => void;
  handy: boolean;
  /** Auch am Rechner als Auswahlknopf mit Menü statt als Umschalter – ab etwa vier Ansichten. */
  alsKnopf?: boolean;
  ariaLabel?: string;
}) {
  const [offen, setOffen] = useState(false);
  const jetzt = options.find((o) => o.value === value)?.label ?? ariaLabel;
  const merker = options.find((o) => o.zahl)?.zahl ?? 0;
  if (!handy && alsKnopf)
    return (
      <KnopfMitMenue
        links
        titel={ariaLabel}
        optionen={options.map((o) => ({
          label: blattText(o),
          gewaehlt: o.value === value,
          onClick: () => onChange(o.value),
        }))}
        knopf={({ offen: auf, umschalten }) => (
          <button
            type="button"
            className={styles.knopf}
            aria-haspopup="menu"
            aria-expanded={auf}
            aria-label={`${ariaLabel}: ${jetzt}`}
            onClick={umschalten}
          >
            {jetzt}
            <Icon name="chev-down" size={14} stroke={2.4} />
            <ReiterZaehler zahl={merker} ton="blau" />
          </button>
        )}
      />
    );
  if (!handy)
    return (
      <Segment
        value={value}
        options={options.map((o) => ({
          value: o.value,
          label:
            o.zahl || o.anzahl ? (
              <>
                {o.label}
                <ReiterZaehler zahl={o.zahl ?? 0} ton="blau" />
                {o.anzahl ? <span className={styles.anzahl}>{o.anzahl}</span> : null}
              </>
            ) : (
              o.label
            ),
          // Mit Zahl trägt der Name sie mit (der Kreis selbst ist `aria-hidden`).
          name: o.zahl || o.anzahl ? `${o.label}, ${o.zahl ?? o.anzahl}` : undefined,
        }))}
        onChange={onChange}
        ariaLabel={ariaLabel}
        className={styles.segment}
        verbunden
      />
    );
  return (
    <>
      <button
        type="button"
        className={styles.knopf}
        aria-haspopup="dialog"
        aria-expanded={offen}
        aria-label={`${ariaLabel}: ${jetzt}`}
        onClick={() => setOffen(true)}
      >
        {jetzt}
        <Icon name="chev-down" size={14} stroke={2.4} />
        <ReiterZaehler zahl={merker} ton="blau" />
      </button>
      {offen && (
        <AuswahlBlatt
          titel={ariaLabel}
          optionen={options.map((o) => ({
            label: blattText(o),
            gewaehlt: o.value === value,
            onClick: () => {
              setOffen(false);
              onChange(o.value);
            },
          }))}
          onClose={() => setOffen(false)}
        />
      )}
    </>
  );
}
