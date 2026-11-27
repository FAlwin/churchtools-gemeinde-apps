import { useId, useState } from 'react';
import { FensterKnopf } from '../fenster/FensterKnopf';
import { Sheet } from '../fenster/Sheet';
import { useAufklapp } from './useAufklapp';
import { HANDY_BREITE, useMedienAbfrage } from './useMedienAbfrage';
import styles from './MehrfachWahl.module.scss';

export interface MehrfachOption<T extends string | number> {
  wert: T;
  text: string;
  /** Leise hinter dem Text, z. B. die Anzahl „(80)“. */
  zusatz?: string;
  /** Vorgelesener Name des Häkchens, wenn er mehr sagen soll als `text` („Saal · Raum“). */
  name?: string;
}

export interface MehrfachGruppe<T extends string | number> {
  /** Überschrift der Gruppe; leer = ohne Überschrift. */
  titel: string;
  optionen: readonly MehrfachOption<T>[];
}

/**
 * **Ein Feld mit Häkchen-Liste: mehrere auf einmal wählen** (Protokolle „Ressourcen wählen“, Alwin 27.11.2026: „wenn ich
 * sofort mehrere anklicken könnte, die dann unten erscheinen“). Das Feld sieht aus wie eine Auswahl daneben und nennt das
 * Gewählte; ein Tipp klappt die Liste auf, nach Gruppen. Jedes Häkchen meldet sich sofort (`onUmschalten`) – was daraus
 * wird, bleibt beim Aufrufer. Am Handy kommt die Liste als Fenster („Fenster sind immer Modale“, design-system.md), am
 * iPad/Rechner klappt sie unter dem Feld auf – **im Fluss**, nicht schwebend: In einem Fenster, das selbst scrollt, würde
 * ein schwebendes Menü an der Unterkante abgeschnitten (Durchklicken 27.11.2026). `feldKlasse` gibt dem Feld das Aussehen
 * der Felder des Aufrufers (Höhe, Polster).
 */
export function MehrfachWahl<T extends string | number>(p: {
  gruppen: readonly MehrfachGruppe<T>[];
  gewaehlt: ReadonlySet<T>;
  onUmschalten: (wert: T) => void;
  /** Steht im Feld, solange nichts gewählt ist („Ressourcen wählen …“). */
  platzhalter: string;
  /** Name von Feld und Liste („Ressourcen wählen“). */
  titel: string;
  /** Statt Platzhalter, solange die Möglichkeiten laden – das Feld ist dann gesperrt. */
  laedt?: string;
  deaktiviert?: boolean;
  feldKlasse?: string;
}) {
  const { offen, setOffen, rahmen } = useAufklapp();
  const [fensterOffen, setFensterOffen] = useState(false);
  const handy = useMedienAbfrage(HANDY_BREITE);
  const id = useId();
  const alle = p.gruppen.flatMap((g) => g.optionen);
  const namen = alle.filter((o) => p.gewaehlt.has(o.wert)).map((o) => o.text);
  const text = p.laedt ?? (namen.length ? namen.join(', ') : p.platzhalter);
  const aus = !!p.deaktiviert || !!p.laedt || !alle.length;
  const auf = handy ? fensterOffen : offen;

  const liste = (
    <div className={styles.liste}>
      {p.gruppen.map((g) => (
        <fieldset key={g.titel || '–'} className={styles.abschnitt}>
          {g.titel && <legend>{g.titel}</legend>}
          {g.optionen.map((o) => (
            <label key={o.wert} className={styles.zeile}>
              <input
                type="checkbox"
                checked={p.gewaehlt.has(o.wert)}
                disabled={p.deaktiviert}
                aria-label={o.name ?? o.text}
                onChange={() => p.onUmschalten(o.wert)}
              />
              <span>{o.text}</span>
              {o.zusatz && <span className={styles.zusatz}>{o.zusatz}</span>}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );

  return (
    <div className={styles.rahmen} ref={rahmen}>
      <button
        type="button"
        className={`${styles.feld}${p.feldKlasse ? ' ' + p.feldKlasse : ''}`}
        aria-haspopup="dialog"
        aria-expanded={auf}
        aria-controls={auf ? id : undefined}
        aria-label={namen.length ? `${p.titel} (gewählt: ${namen.join(', ')})` : p.titel}
        disabled={aus}
        onClick={() => (handy ? setFensterOffen(true) : setOffen(!offen))}
      >
        <span className={styles.text}>{text}</span>
      </button>
      {!handy && offen && (
        <div className={styles.menue} id={id} role="dialog" aria-label={p.titel}>
          {liste}
        </div>
      )}
      {handy && fensterOffen && (
        <Sheet
          title={p.titel}
          onClose={() => setFensterOffen(false)}
          cancelLabel={null}
          knoepfe={<FensterKnopf onClick={() => setFensterOffen(false)}>Fertig</FensterKnopf>}
        >
          <div id={id}>{liste}</div>
        </Sheet>
      )}
    </div>
  );
}
