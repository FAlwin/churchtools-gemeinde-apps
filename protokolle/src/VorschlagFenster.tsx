import { useState } from 'react';
import { Sheet } from '@ui/fenster/Sheet';
import { FensterKnopf } from '@ui/fenster/FensterKnopf';
import { fehlerMeldung } from '@ui/ct/fehlerMeldung';
import type { Sitzung } from '@shared/protokolle/sitzungen';
import {
  NAECHSTE,
  TITEL_MAX,
  zielVon,
  type Vorschlag,
  type VorschlagZiel,
} from '@shared/protokolle/vorschlaege';
import { datumText } from '@shared/ct/datum';
import { ortszeitAus } from '@shared/ct/zeit';
import felder from './Fensterfelder.module.scss';
import styles from './Vorschlaege.module.scss';

const NAECHSTE_WERT = 'naechste';

/**
 * **Fenster „Punkt vorschlagen“ / „Vorschlag ändern“** (S5-4, Entwurf v1): für welche Sitzung (vorbelegt die nächste;
 * ohne festgelegte „Nächste Sitzung“), Thema, freiwillig ein Text. `sitzungen` = die kommenden ab heute; `jetzt` = wohin
 * der Vorschlag gerade gehört (beim Ändern). Speichern übernimmt der Aufrufer – das Fenster zeigt nur Lauf und Fehler.
 */
export function VorschlagFenster({
  gruppe,
  sitzungen,
  vorher = null,
  jetzt = null,
  direkt,
  zeitzone,
  onSpeichern,
  onClose,
}: {
  gruppe: string;
  sitzungen: readonly Sitzung[];
  /** Beim Ändern: der Vorschlag. */
  vorher?: Vorschlag | null;
  /** Beim Ändern: die Sitzung, zu der er gerade gehört (`zielSitzung`). */
  jetzt?: Sitzung | null;
  /** Gruppe „Direkt eintragen“: der Punkt kommt ohne Entscheidung der Leitung ins Protokoll. */
  direkt: boolean;
  zeitzone: string;
  onSpeichern: (x: { titel: string; text: string; ziel: VorschlagZiel }) => Promise<void>;
  onClose: () => void;
}) {
  // Vorbelegt: beim Ändern, wohin er gerade gehört; sonst die nächste Sitzung – ohne festgelegte „Nächste Sitzung“.
  const [fuer, setFuer] = useState<string>(
    (vorher ? jetzt : sitzungen[0])?.schluessel ?? NAECHSTE_WERT,
  );
  const [titel, setTitel] = useState(vorher?.titel ?? '');
  const [text, setText] = useState(vorher?.text ?? '');
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  // Die gewählte Sitzung – beim Ändern auch eine, die nicht (mehr) in der Liste ab heute steht (Protokoll von gestern).
  const auswahl = [...sitzungen, ...(jetzt && !sitzungen.includes(jetzt) ? [jetzt] : [])];
  const bereit = !!titel.trim() && !laeuft;

  const speichern = async () => {
    if (!bereit) return;
    const s = auswahl.find((x) => x.schluessel === fuer);
    setLaeuft(true);
    setFehler(null);
    try {
      await onSpeichern({ titel, text, ziel: s ? zielVon(s) : NAECHSTE });
    } catch (e) {
      setLaeuft(false);
      setFehler(fehlerMeldung(e).text);
    }
  };

  return (
    <Sheet
      title={vorher ? 'Vorschlag ändern' : 'Punkt vorschlagen'}
      onClose={onClose}
      beschaeftigt={laeuft}
      knoepfe={
        <FensterKnopf disabled={!bereit} onClick={() => void speichern()}>
          {laeuft ? 'Wird gespeichert …' : vorher ? 'Speichern' : 'Vorschlagen'}
        </FensterKnopf>
      }
    >
      <p className={felder.unter}>{gruppe}</p>
      <label className={felder.feld}>
        {/* Ohne Uhrzeit – am Handy war die Zeile sonst abgeschnitten. */}
        <span>Für</span>
        <select
          className={felder.eingabe}
          value={fuer}
          disabled={laeuft}
          onChange={(e) => setFuer(e.target.value)}
        >
          {auswahl.length ? (
            auswahl.map((s) => (
              <option key={s.schluessel} value={s.schluessel}>
                {s.titel} · {datumText(ortszeitAus(s.beginn, zeitzone).slice(0, 10))}
              </option>
            ))
          ) : (
            <option value={NAECHSTE_WERT}>Nächste Sitzung (noch nicht festgelegt)</option>
          )}
        </select>
        {!auswahl.length && (
          <small className={styles.klein}>
            Sobald die Leitung die nächste Sitzung festlegt, steht dein Vorschlag dort.
          </small>
        )}
      </label>
      <label className={felder.feld}>
        <span>Thema</span>
        <input
          className={felder.eingabe}
          value={titel}
          maxLength={TITEL_MAX}
          disabled={laeuft}
          placeholder="z. B. Kinderbetreuung beim Gemeindeessen"
          onChange={(e) => setTitel(e.target.value)}
        />
      </label>
      <label className={felder.feld}>
        <span>Worum geht es? (freiwillig)</span>
        <textarea
          className={`${felder.eingabe} ${styles.text}`}
          value={text}
          rows={3}
          disabled={laeuft}
          placeholder="Ein, zwei Sätze für die Leitung"
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <p className={felder.leise}>
        {direkt
          ? 'In dieser Gruppe kommt dein Vorschlag direkt als Punkt ins Protokoll.'
          : 'Die Leitung entscheidet, ob der Punkt auf die Tagesordnung kommt. Bis dahin kannst du ihn ändern oder zurückziehen.'}{' '}
        Alle in der Gruppe sehen ihn.
      </p>
      {fehler && (
        <p className={felder.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}

/** **Vorschlag ablehnen** (S5-4) – die Begründung ist freiwillig; wer vorschlug, sieht sie beim Vorschlag. */
export function VorschlagAblehnen({
  vorschlag,
  onAblehnen,
  onClose,
}: {
  vorschlag: Vorschlag;
  onAblehnen: (grund: string) => Promise<void>;
  onClose: () => void;
}) {
  const [grund, setGrund] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const ablehnen = async () => {
    setLaeuft(true);
    setFehler(null);
    try {
      await onAblehnen(grund);
    } catch (e) {
      setLaeuft(false);
      setFehler(fehlerMeldung(e).text);
    }
  };
  const vorname = vorschlag.name.split(' ')[0];
  return (
    <Sheet
      title="Vorschlag ablehnen"
      onClose={onClose}
      beschaeftigt={laeuft}
      knoepfe={
        <FensterKnopf disabled={laeuft} art="gefahr" onClick={() => void ablehnen()}>
          {laeuft ? 'Wird gespeichert …' : 'Ablehnen'}
        </FensterKnopf>
      }
    >
      <p className={felder.unter}>
        <b>{vorschlag.titel}</b> · von {vorschlag.name}
      </p>
      <label className={felder.feld}>
        <span>Begründung (freiwillig – {vorname} sieht sie beim Vorschlag)</span>
        <textarea
          className={`${felder.eingabe} ${styles.text}`}
          value={grund}
          rows={3}
          disabled={laeuft}
          placeholder="z. B. Klären wir im Gemeinderat."
          onChange={(e) => setGrund(e.target.value)}
        />
      </label>
      {fehler && (
        <p className={felder.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}
