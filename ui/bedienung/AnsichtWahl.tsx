import { useState } from 'react';
import { Icon } from '../icons/icons';
import { Segment } from './Segment';
import { AuswahlBlatt } from './OptionWaehlen';
import { ReiterZaehler } from './ReiterZaehler';
import styles from './AnsichtWahl.module.scss';

/**
 * **Die Ansichtswahl der Werkzeugzeile** (R4/E9, „Ruhige Bedienung“ B3): am Rechner der Umschalter (`Segment`, verbunden –
 * der eine Kasten-Umschalter je Zeile), am Handy ein blau hinterlegter Knopf in Wortbreite mit Pfeil („Matrix ⌄“), der
 * beim Antippen die Ansichten als Blatt von unten aufklappt (`AuswahlBlatt`). Beides sieht aus wie der gewählte Umschalter
 * am Rechner – nur nimmt der Knopf am Handy so wenig Platz wie sein Wort.
 *
 * Eine Ansicht kann einen **Merker** tragen (`zahl`, B4/E24: „Einträge“ in „Wann kann ich?“): ein blau gefüllter Kreis direkt
 * hinter dem Wort, in derselben Zeile. Am Handy steht der Merker einer anderen Ansicht hinter dem Pfeil, damit man ihn
 * nicht erst im Blatt findet; im Blatt selbst steht die Zahl in Klammern.
 */
export function AnsichtWahl<T extends string>({
  value,
  options,
  onChange,
  handy,
  ariaLabel = 'Ansicht',
}: {
  value: T;
  options: { value: T; label: string; zahl?: number }[];
  onChange: (v: T) => void;
  handy: boolean;
  ariaLabel?: string;
}) {
  const [offen, setOffen] = useState(false);
  if (!handy)
    return (
      <Segment
        value={value}
        options={options.map((o) => ({
          value: o.value,
          label: o.zahl ? (
            <>
              {o.label}
              <ReiterZaehler zahl={o.zahl} ton="blau" />
            </>
          ) : (
            o.label
          ),
          // Mit Zahl trägt der Name sie mit (der Kreis selbst ist `aria-hidden`).
          name: o.zahl ? `${o.label}, ${o.zahl}` : undefined,
        }))}
        onChange={onChange}
        ariaLabel={ariaLabel}
        className={styles.segment}
        verbunden
      />
    );
  const jetzt = options.find((o) => o.value === value)?.label ?? ariaLabel;
  const merker = options.find((o) => o.zahl)?.zahl ?? 0;
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
            label: o.zahl ? `${o.label} (${o.zahl})` : o.label,
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
