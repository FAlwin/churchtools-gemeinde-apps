/**
 * **„Predigtserie“** (Dienstplaner, 27.11.2026) – wie der Stift an der Predigtserie in der ChurchTools-App: ein Feld,
 * „Speichern“. Leer gespeichert = keine Predigtserie. Freitext (ChurchTools kennt keine Liste vorhandener Serien,
 * gemessen 27.11.2026). Die Regel (Länge, Rand-Leerzeichen) kommt aus dem Kern (`serieFehler`, `SERIE_MAX`) – dieselbe,
 * die vor dem Schreiben prüft; das Fenster warnt nur früher. Feld und Stil teilt es mit den Vorlagen-Fenstern.
 */
import { useState, type FormEvent } from 'react';
import { SERIE_MAX, serieAus, serieFehler } from '@shared/ct/schreibKern';
import { FensterKnopf } from '../fenster/FensterKnopf';
import { Sheet } from '../fenster/Sheet';
import { meldung } from './vorlagenMeta';
import { NameFeld } from './VorlagenFenster';
import styles from './VorlagenFenster.module.scss';

export function PredigtserieFenster({
  serie,
  geteilt,
  onSpeichern,
  onClose,
}: {
  /** Die Serie, wie sie jetzt in ChurchTools steht (`null` = keine). */
  serie: string | null;
  /** Teilen sich mehrere Termine diesen Ablauf? Dann gilt die Serie für alle – das steht im Hinweis. */
  geteilt: boolean;
  /** Wirft bei Fehler – die Meldung steht dann im Fenster. */
  onSpeichern: (serie: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState(serie ?? '');
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const feldFehler = serieFehler(text);
  const unveraendert = serieAus(text) === serie;

  async function speichern(e?: FormEvent) {
    e?.preventDefault();
    if (feldFehler) return setFehler(feldFehler);
    if (unveraendert) return onClose();
    setFehler(null);
    setLaeuft(true);
    try {
      await onSpeichern(serieAus(text));
    } catch (err) {
      setFehler(meldung(err, 'Die Predigtserie konnte nicht gespeichert werden.'));
      setLaeuft(false);
    }
  }

  return (
    <Sheet
      title="Predigtserie"
      onClose={onClose}
      beschaeftigt={laeuft}
      knoepfe={
        <FensterKnopf onClick={() => void speichern()} disabled={laeuft || feldFehler !== null}>
          {laeuft ? 'Speichere …' : 'Speichern'}
        </FensterKnopf>
      }
    >
      <form onSubmit={(e) => void speichern(e)}>
        <NameFeld
          label="Predigtserie"
          max={SERIE_MAX}
          wert={text}
          onChange={(w) => {
            setText(w);
            setFehler(null);
          }}
          fehler={feldFehler}
          hinweis={`Leer lassen = keine Predigtserie. Höchstens ${SERIE_MAX} Zeichen.${
            geteilt ? ' Gilt für alle Termine mit diesem Ablauf.' : ''
          }`}
          beschaeftigt={laeuft}
        />
        <button type="submit" hidden />
      </form>
      {fehler && (
        <p className={styles.fehler} role="alert">
          {fehler}
        </p>
      )}
    </Sheet>
  );
}
